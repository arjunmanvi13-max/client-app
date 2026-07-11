import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, useAuth } from "./auth";
import { LoadingState, ErrorState, getApiError } from "./ScreenStates";
import { formatDate } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import { fetchDashboardMvp } from "./dashboardApi";

type Entity = "both" | "pws" | "alpha";

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [entity, setEntity] = useState<Entity>("both");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const load = useCallback(async () => {
    setError("");
    try {
      const params = isSuperAdmin ? { entity } : {};
      const d = await fetchDashboardMvp(params);
      setData(d);
    } catch (e: any) {
      setError(getApiError(e));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entity, isSuperAdmin]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (!user) return null;

  const att = data?.attendance_today || {};
  const fees = data?.fees_collected_today || {};
  const inv = data?.outstanding_invoices || {};

  return (
    <SafeAreaView style={s.safe} edges={["top"]} testID="super-admin-dashboard">
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>DASHBOARD · {formatDate(data?.today)}</Text>
            <Text style={s.h1}>Hello, {user.name.split(" ")[0]}</Text>
            <Text style={s.sub}>{isSuperAdmin ? "Operations snapshot — PWS & ALPHA" : "ALPHA Sports Academy operations"}</Text>
          </View>
          <TouchableOpacity testID="sa-notif" style={s.bellBtn} onPress={() => router.push("/notifications")}>
            <Feather name="bell" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {isSuperAdmin && (
          <>
            <Text style={s.filterLabel}>Entity</Text>
            <View style={s.chipRow}>
              {(["both", "pws", "alpha"] as Entity[]).map((v) => (
                <TouchableOpacity key={v} testID={`entity-${v}`} onPress={() => setEntity(v)} style={[s.chip, entity === v && s.chipActive]}>
                  <Text style={[s.chipTxt, entity === v && s.chipTxtActive]}>
                    {v === "both" ? "Combined" : v.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {loading && !refreshing ? (
          <LoadingState message="Loading dashboard…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <View style={s.grid}>
              <Tile testID="tile-people" label="Active people" value={String(data?.active_people ?? 0)} icon="users" tint="#1E40AF" onPress={() => router.push("/manage/student")} />
              <Tile testID="tile-attendance" label="Attendance today" value={String(att.total ?? 0)} sub={`${att.present ?? 0} present`} icon="check-square" tint="#10B981" onPress={() => router.push("/(tabs)/attendance")} />
              <Tile testID="tile-fees" label="Fees collected" value={inr(fees.total)} sub={`${fees.transaction_count ?? 0} txn`} icon="dollar-sign" tint="#16A34A" onPress={() => router.push("/reports")} />
              <Tile testID="tile-invoices" label="Outstanding" value={inr(inv.total)} sub={`${inv.count ?? 0} invoices`} icon="file-text" tint="#EA580C" onPress={() => router.push("/invoices")} />
              <Tile testID="tile-approvals" label="Pending approvals" value={String(data?.pending_approvals ?? 0)} icon="shield" tint="#7C3AED" onPress={() => router.push("/admin/approvals")} />
              <Tile testID="tile-tasks" label="Open tasks" value={String(data?.open_tasks ?? 0)} icon="list" tint="#0EA5E9" onPress={() => router.push("/(tabs)/tasks")} />
            </View>

            <Text style={s.section}>Today's attendance breakdown</Text>
            <View style={s.breakdown}>
              <Mini label="Present" value={att.present ?? 0} tint="#10B981" />
              <Mini label="Absent" value={att.absent ?? 0} tint="#EF4444" />
              <Mini label="Late" value={att.late ?? 0} tint="#F59E0B" />
              <Mini label="Leave" value={att.leave ?? 0} tint="#7C3AED" />
            </View>

            <Text style={s.section}>Quick actions</Text>
            <View style={s.actions}>
              <Action icon="check-square" label="Attendance" onPress={() => router.push("/(tabs)/attendance")} />
              <Action icon="list" label="Tasks" onPress={() => router.push("/(tabs)/tasks")} />
              <Action icon="shield" label="Approvals" onPress={() => router.push("/admin/approvals")} />
              <Action icon="bar-chart-2" label="Reports" onPress={() => router.push("/reports")} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value, sub, icon, tint, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={[s.tile, { borderTopColor: tint }]} onPress={onPress}>
      <Feather name={icon} size={16} color={tint} />
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
      {sub ? <Text style={s.tileSub}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

function Mini({ label, value, tint }: any) {
  return (
    <View style={s.mini}>
      <Text style={[s.miniVal, { color: tint }]}>{value}</Text>
      <Text style={s.miniLbl}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress}>
      <Feather name={icon} size={18} color="#1E40AF" />
      <Text style={s.actionLbl}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: "#94A3B8" },
  h1: { fontSize: 26, fontWeight: "700", color: "#0F172A", marginTop: 4 },
  sub: { fontSize: 12, color: "#64748B", marginTop: 4 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  filterLabel: { fontSize: 11, fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8, marginBottom: 6 },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "47%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", borderTopWidth: 3, minWidth: 140 },
  tileValue: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginTop: 8 },
  tileLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginTop: 4, textTransform: "uppercase" },
  tileSub: { fontSize: 10, color: "#94A3B8", marginTop: 2 },
  section: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 24, marginBottom: 10 },
  breakdown: { flexDirection: "row", gap: 8, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  mini: { flex: 1, alignItems: "center" },
  miniVal: { fontSize: 20, fontWeight: "800" },
  miniLbl: { fontSize: 10, color: "#64748B", marginTop: 2, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: { flexBasis: "22%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", minWidth: 72 },
  actionLbl: { fontSize: 11, fontWeight: "600", color: "#0F172A", marginTop: 6, textAlign: "center" },
});

import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../src/auth";

type Ward = {
  id: string;
  name: string;
  kind: string;
  group?: string;
  sport?: string;
  centre?: string;
  organization: string;
  today_status?: string | null;
  attendance_30d?: { total: number; present: number; absent: number; pct: number | null };
};

type Alert = {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  ward_id: string;
  ward_name: string;
  amount_due?: number;
  created_at: string;
};

const SEV_TINT: Record<string, { bg: string; text: string; icon: any }> = {
  high: { bg: "#FEE2E2", text: "#B91C1C", icon: "alert-octagon" },
  medium: { bg: "#FEF3C7", text: "#B45309", icon: "alert-triangle" },
  low: { bg: "#E0F2FE", text: "#075985", icon: "info" },
};

const STATUS_TINT: Record<string, string> = {
  present: "#10B981",
  absent: "#EF4444",
  late: "#F59E0B",
  leave: "#7C3AED",
};

export default function ParentHome() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [wards, setWards] = useState<Ward[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stored, setStored] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, a] = await Promise.all([
        api.get("/parent/wards"),
        api.get("/parent/alerts"),
      ]);
      setWards(w.data);
      setAlerts(a.data.computed || []);
      setStored(a.data.stored || []);
    } catch (e: any) {
      console.log("parent home load err", e?.response?.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!user) return null;

  const unreadCount = stored.filter((s) => !s.read).length + alerts.length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>PARENT PORTAL</Text>
            <Text style={s.h1}>Hi, {user.name.split(" ")[0]}</Text>
            <Text style={s.sub}>Track your ward's attendance, fees and alerts</Text>
          </View>
          <TouchableOpacity testID="parent-logout" style={s.iconBtn} onPress={() => Alert.alert("Sign out?", "", [{text:"Cancel",style:"cancel"},{text:"Sign out",style:"destructive",onPress:async()=>{await logout();router.replace("/login");}}])}>
            <Feather name="log-out" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#0891B2" style={{ marginTop: 60 }} />
        ) : wards.length === 0 ? (
          <View style={s.empty}>
            <Feather name="users" size={40} color="#94A3B8" />
            <Text style={s.emptyTxt}>No ward linked yet.</Text>
            <Text style={s.emptySub}>Ask your admin to link your account to your child's record.</Text>
          </View>
        ) : (
          <>
            <Text style={s.section}>My Wards</Text>
            {wards.map((w) => {
              const pct = w.attendance_30d?.pct;
              const todaySt = w.today_status;
              return (
                <TouchableOpacity
                  key={w.id}
                  testID={`ward-card-${w.id}`}
                  style={s.wardCard}
                  onPress={() => router.push({ pathname: "/parent/ward/[id]" as any, params: { id: w.id } })}
                >
                  <View style={s.wardRow}>
                    <View style={[s.wardAvatar, { backgroundColor: w.organization === "ALPHA" ? "#FED7AA" : "#DBEAFE" }]}>
                      <Text style={[s.wardAvatarTxt, { color: w.organization === "ALPHA" ? "#EA580C" : "#2563EB" }]}>
                        {w.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.wardName}>{w.name}</Text>
                      <Text style={s.wardMeta}>
                        {w.kind === "player" ? `${w.sport || ""} · ${w.centre || ""}` : `${w.group || ""}`} · {w.organization}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color="#94A3B8" />
                  </View>
                  <View style={s.statsRow}>
                    <View style={s.statBlock}>
                      <Text style={[s.statValue, { color: todaySt ? (STATUS_TINT[todaySt] || "#0F172A") : "#94A3B8" }]}>
                        {todaySt ? todaySt.charAt(0).toUpperCase() + todaySt.slice(1) : "—"}
                      </Text>
                      <Text style={s.statLabel}>Today</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.statBlock}>
                      <Text style={[s.statValue, { color: pct !== null && pct !== undefined ? (pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444") : "#94A3B8" }]}>
                        {pct !== null && pct !== undefined ? `${pct}%` : "—"}
                      </Text>
                      <Text style={s.statLabel}>30-day</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.statBlock}>
                      <Text style={[s.statValue, { color: (w.attendance_30d?.absent || 0) > 0 ? "#EF4444" : "#10B981" }]}>
                        {w.attendance_30d?.absent ?? 0}
                      </Text>
                      <Text style={s.statLabel}>Absences</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={s.alertsHeader}>
              <Text style={s.section}>Alerts</Text>
              {unreadCount > 0 && (
                <View style={s.unreadDot}><Text style={s.unreadTxt}>{unreadCount}</Text></View>
              )}
            </View>
            {alerts.length === 0 && stored.length === 0 ? (
              <View style={s.noAlerts}>
                <Feather name="check-circle" size={28} color="#10B981" />
                <Text style={s.noAlertsTxt}>All caught up!</Text>
                <Text style={s.noAlertsSub}>No alerts right now.</Text>
              </View>
            ) : (
              <>
                {alerts.map((a) => {
                  const tint = SEV_TINT[a.severity] || SEV_TINT.low;
                  return (
                    <View key={a.id} testID={`alert-${a.type}-${a.ward_id}`} style={[s.alertCard, { backgroundColor: tint.bg }]}>
                      <Feather name={tint.icon} size={18} color={tint.text} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[s.alertTitle, { color: tint.text }]}>{a.title}</Text>
                        <Text style={s.alertMsg}>{a.message}</Text>
                      </View>
                    </View>
                  );
                })}
                {stored.map((n) => (
                  <View key={n.id} testID={`notif-${n.id}`} style={[s.alertCard, { backgroundColor: "#F1F5F9" }]}>
                    <Feather name="bell" size={18} color="#475569" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[s.alertTitle, { color: "#0F172A" }]}>{n.title}</Text>
                      <Text style={s.alertMsg}>{n.message || n.body}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 80 },
  header: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  iconBtn: { padding: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 26, fontWeight: "700", color: "#0F172A", marginTop: 2, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  empty: { padding: 40, alignItems: "center", gap: 6 },
  emptyTxt: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 12 },
  emptySub: { fontSize: 13, color: "#64748B", textAlign: "center" },
  section: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginTop: 8, marginBottom: 12, letterSpacing: -0.3 },
  wardCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10 },
  wardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  wardAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  wardAvatarTxt: { fontWeight: "800", fontSize: 15 },
  wardName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  wardMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  statsRow: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9", alignItems: "center" },
  statBlock: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 26, backgroundColor: "#E2E8F0" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  alertsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  unreadDot: { backgroundColor: "#EF4444", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, minWidth: 22, alignItems: "center" },
  unreadTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  noAlerts: { padding: 24, alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 14, gap: 4 },
  noAlertsTxt: { fontSize: 14, fontWeight: "700", color: "#065F46", marginTop: 8 },
  noAlertsSub: { fontSize: 12, color: "#16A34A" },
  alertCard: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderRadius: 14, marginBottom: 8 },
  alertTitle: { fontSize: 13, fontWeight: "800" },
  alertMsg: { fontSize: 12, color: "#475569", marginTop: 2, lineHeight: 16 },
});

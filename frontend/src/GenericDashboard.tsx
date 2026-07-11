import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth, ROLE_COLORS, PRIORITY_COLORS, STATUS_COLORS } from "./auth";
import { LoadingState, ErrorState, EmptyState, getApiError } from "./ScreenStates";
import { useBreakpoint } from "./useBreakpoint";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin", admin: "Administrator", teacher: "Teacher",
  coach: "Coach", warden: "Warden", staff: "Staff", student: "Student", player: "Player",
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [data, setData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [attSummary, setAttSummary] = useState<any>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [d, t, a] = await Promise.all([
        api.get("/dashboard"),
        api.get("/tasks", { params: { mine: true } }),
        api.get("/attendance/summary"),
      ]);
      setData(d.data);
      setTasks(t.data.slice(0, 5));
      setAttSummary(a.data);
    } catch (e: any) {
      setError(getApiError(e));
      setData(null);
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (!user) return null;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {loading && !refreshing ? (
          <LoadingState message="Loading dashboard…" />
        ) : (
        <>
        {error ? <ErrorState message={error} onRetry={load} compact /> : null}
        {/* Header */}
        <View style={s.header}>
          <Image source={require("../assets/alpha-sports-logo.png")} style={s.headerLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>{greeting.toUpperCase()}</Text>
            <Text style={s.h1}>{user.name.split(" ")[0]}</Text>
            <View style={[s.rolePill, { backgroundColor: ROLE_COLORS[user.role] + "1A", borderColor: ROLE_COLORS[user.role] }]}>
              <View style={[s.dot, { backgroundColor: ROLE_COLORS[user.role] }]} />
              <Text style={[s.roleText, { color: ROLE_COLORS[user.role] }]}>{ROLE_LABEL[user.role]}</Text>
              <Text style={s.org}>· {user.organization}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.bellBtn} onPress={() => router.push("/notifications")} testID="notif-btn">
            <Feather name="bell" size={20} color="#0F172A" />
            {data?.unread_notifications > 0 && <View style={s.bellDot} />}
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={s.statsGrid}>
          <StatTile testID="stat-mytasks" label="My Tasks" value={data?.my_tasks ?? "—"} icon="list" tint="#1E40AF" />
          <StatTile testID="stat-pending" label="Pending" value={data?.pending_tasks ?? "—"} icon="clock" tint="#F59E0B" />
          <StatTile testID="stat-overdue" label="Overdue" value={data?.overdue_tasks ?? "—"} icon="alert-triangle" tint="#EF4444" />
          <StatTile testID="stat-unread" label="Unread" value={data?.unread_notifications ?? "—"} icon="bell" tint="#7C3AED" />
        </View>

        {/* Admin/warden extras */}
        {(user.role === "admin" || user.role === "super_admin") && (
          <View style={s.adminRow}>
            <AdminMini label="Total Users" value={data?.total_users ?? 0} icon="users" />
            <AdminMini label="Total Tasks" value={data?.total_tasks ?? 0} icon="briefcase" />
            <AdminMini label="Pending Pass" value={data?.pending_gate_passes ?? 0} icon="log-out" />
          </View>
        )}
        {user.role === "warden" && (
          <View style={s.adminRow}>
            <AdminMini label="Residents" value={data?.residents ?? 0} icon="users" />
            <AdminMini label="Pending Pass" value={data?.pending_gate_passes ?? 0} icon="log-out" />
          </View>
        )}

        {/* Quick actions */}
        <Text style={s.sectionTitle}>Quick actions</Text>
        <View style={s.actionsRow}>
          <Action icon="check-square" label="Mark Attendance" tint="#10B981" onPress={() => router.push("/(tabs)/attendance")} testID="qa-attendance" />
          <Action icon="plus-square" label="New Task" tint="#1E40AF" onPress={() => router.push("/task/new")} testID="qa-newtask" />
          {["warden", "admin", "super_admin"].includes(user.role) && (
            <Action icon="log-out" label="Gate Pass" tint="#7C3AED" onPress={() => router.push("/(tabs)/hostel")} testID="qa-hostel" />
          )}
          {(user.role === "principal" || user.role === "vice_principal") && (
            <Action icon="users" label="Staff Attendance" tint="#BE185D" onPress={() => router.push("/staff-attendance")} testID="qa-staff-attendance" />
          )}
        </View>

        {/* Today attendance summary */}
        {attSummary?.summary && Object.keys(attSummary.summary).length > 0 && (
          <>
            <Text style={s.sectionTitle}>Today's attendance</Text>
            <View style={s.attCard}>
              {Object.entries(attSummary.summary).map(([kind, vals]: any) => (
                <View key={kind} style={s.attRow}>
                  <Text style={s.attKind}>{kind.toUpperCase()}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Mini label="P" value={vals.present || 0} color="#10B981" />
                    <Mini label="A" value={vals.absent || 0} color="#EF4444" />
                    <Mini label="L" value={vals.late || 0} color="#F59E0B" />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* My recent tasks */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 28 }}>
          <Text style={s.sectionTitle}>My recent tasks</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/tasks")}>
            <Text style={s.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {tasks.length === 0 ? (
          <EmptyState icon="clipboard" title="No tasks yet" message="Assign one from the Tasks tab or create a new task." actionLabel="View tasks" onAction={() => router.push("/(tabs)/tasks")} />
        ) : (
          tasks.map((t) => (
            <TouchableOpacity key={t.id} style={s.taskCard} onPress={() => router.push(`/task/${t.id}`)} testID={`task-${t.id}`}>
              <View style={[s.priorityBar, { backgroundColor: PRIORITY_COLORS[t.priority] }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.taskTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={s.taskMeta} numberOfLines={1}>{t.created_by_name} · {t.priority.toUpperCase()}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: STATUS_COLORS[t.status] + "1A" }]}>
                <Text style={[s.statusText, { color: STATUS_COLORS[t.status] }]}>{t.status.replace("_", " ")}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ label, value, icon, tint, testID }: any) {
  return (
    <View style={s.tile} testID={testID}>
      <View style={[s.tileIcon, { backgroundColor: tint + "1A" }]}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}
function AdminMini({ label, value, icon }: any) {
  return (
    <View style={s.adminTile}>
      <Feather name={icon} size={16} color="#fff" />
      <Text style={s.adminValue}>{value}</Text>
      <Text style={s.adminLabel}>{label}</Text>
    </View>
  );
}
function Action({ icon, label, tint, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={s.actionBtn} onPress={onPress}>
      <View style={[s.actionIcon, { backgroundColor: tint + "1A" }]}>
        <Feather name={icon} size={20} color={tint} />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}
function Mini({ label, value, color }: any) {
  return (
    <View style={[s.miniBox, { backgroundColor: color + "1A" }]}>
      <Text style={[s.miniLabel, { color }]}>{label}</Text>
      <Text style={[s.miniValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 10 },
  headerLogo: { width: 44, height: 44 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 30, fontWeight: "700", color: "#0F172A", marginTop: 4, letterSpacing: -0.5 },
  rolePill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 12, fontWeight: "700" },
  org: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  bellDot: { position: "absolute", top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  tileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  tileValue: { fontSize: 26, fontWeight: "800", color: "#0F172A" },
  tileLabel: { fontSize: 13, color: "#64748B", marginTop: 2 },
  adminRow: { flexDirection: "row", gap: 10, marginTop: 12, backgroundColor: "#0F172A", padding: 14, borderRadius: 16 },
  adminTile: { flex: 1 },
  adminValue: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 4 },
  adminLabel: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginTop: 28, marginBottom: 12 },
  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { flexBasis: "30%", flexGrow: 1, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  actionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  actionLabel: { fontSize: 12, fontWeight: "600", color: "#0F172A", textAlign: "center" },
  attCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  attRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  attKind: { fontSize: 12, fontWeight: "800", color: "#475569", letterSpacing: 1 },
  miniBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignItems: "center", minWidth: 36 },
  miniLabel: { fontSize: 10, fontWeight: "800" },
  miniValue: { fontSize: 14, fontWeight: "800" },
  seeAll: { fontSize: 13, color: "#1E40AF", fontWeight: "700", marginTop: 28 },
  taskCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10, gap: 12 },
  priorityBar: { width: 4, height: 36, borderRadius: 2 },
  taskTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  taskMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  empty: { backgroundColor: "#fff", padding: 24, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  emptyText: { color: "#64748B" },
});

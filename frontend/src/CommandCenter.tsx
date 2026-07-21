import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, useAuth, userHasPermission } from "./auth";
import { BusinessEntity, Permission, UserRole, isSuperAdminUser, normalizeRole } from "./rbac";
import { LoadingState, ErrorState, getApiError } from "./ScreenStates";
import { formatDate } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";

const SEVERITY: Record<string, { tint: string; bg: string; icon: any }> = {
  high: { tint: "#EF4444", bg: "#FEE2E2", icon: "alert-triangle" },
  medium: { tint: "#F59E0B", bg: "#FEF3C7", icon: "alert-circle" },
  low: { tint: "#1E40AF", bg: "#DBEAFE", icon: "info" },
};

export default function CommandCenter() {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/command-center");
      setData(data);
    } catch (e: any) {
      setError(getApiError(e, "Could not load command center."));
      setData(null);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (!user) return null;

  const isSportsAdmin = normalizeRole(user.role) === UserRole.ALPHA_ADMIN;
  const isSuper = isSuperAdminUser(user);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {loading && !refreshing ? (
          <LoadingState message="Loading command center…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data ? (
        <>
        {/* Header */}
        <View style={s.header}>
          <Image source={require("../assets/alpha-sports-logo.png")} style={s.headerLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>{isSportsAdmin ? "SPORTS ADMIN" : "COMMAND CENTRE"} · {formatDate(data.date)}</Text>
            <Text style={s.h1}>Hello, {user.name.split(" ")[0]}</Text>
            <Text style={s.sub}>{isSportsAdmin ? "ALPHA Sports Academy operations" : "Live snapshot across PWS & ALPHA"}</Text>
          </View>
          <TouchableOpacity testID="cc-notif" style={s.bellBtn} onPress={() => router.push("/notifications")}>
            <Feather name="bell" size={20} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* KPI strip */}
        <View style={s.kpiRow}>
          <KpiCard label="Attendance today" value={`${data.kpis.attendance_pct_today}%`} tint="#10B981" icon="check-circle" testID="kpi-att" />
          <KpiCard label="Task completion" value={`${data.kpis.task_completion_pct}%`} tint="#1E40AF" icon="trending-up" testID="kpi-tasks" />
        </View>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <>
            <View style={s.sectionHead}>
              <Text style={s.section}>Live alerts</Text>
              <Text style={s.sectionMeta}>{data.alerts.length}</Text>
            </View>
            {data.alerts.map((a: any) => {
              const sev = SEVERITY[a.severity] || SEVERITY.low;
              return (
                <View key={a.type} style={[s.alertCard, { backgroundColor: sev.bg }]} testID={`alert-${a.type}`}>
                  <Feather name={sev.icon} size={18} color={sev.tint} />
                  <Text style={[s.alertText, { color: sev.tint }]}>{a.message}</Text>
                </View>
              );
            })}
          </>
        )}

        {/* Attendance snapshot */}
        <Text style={s.section}>Attendance snapshot</Text>
        <View style={s.entityGrid}>
          {user.role !== "admin" && !isSportsAdmin && <EntityRow label="Teachers" total={data.roster_counts.teachers} att={data.attendance_by_kind.teacher} icon="book-open" tint="#1E40AF" />}
          <EntityRow label="Coaches" total={data.roster_counts.coaches} att={data.attendance_by_kind.coach} icon="award" tint="#EA580C" />
          <EntityRow label="Staff" total={data.roster_counts.staff} att={data.attendance_by_kind.staff} icon="users" tint="#0EA5E9" />
          {user.role !== "admin" && !isSportsAdmin && <EntityRow label="Students" total={data.roster_counts.students} att={data.attendance_by_kind.student} icon="users" tint="#2563EB" />}
          <EntityRow label="Players" total={data.roster_counts.players} att={data.attendance_by_kind.player} icon="activity" tint="#16A34A" />
          <View style={s.entityRow}>
            <View style={[s.entityIcon, { backgroundColor: "#7C3AED1A" }]}><Feather name="home" size={16} color="#7C3AED" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.entityLabel}>Hostel residents</Text>
              <Text style={s.entityMeta}>{data.departments.hostel.residents} total</Text>
            </View>
            <View style={s.entityCounts}>
              <Mini label="In" value={data.departments.hostel.morning_present} tint="#10B981" />
              <Mini label="Out" value={data.departments.hostel.out_on_pass} tint="#F59E0B" />
            </View>
          </View>
        </View>

        {/* Tasks snapshot */}
        <Text style={s.section}>Task tracker</Text>
        <View style={s.taskCard}>
          <View style={s.taskRow}>
            <TaskBlock label="Pending" value={data.tasks.by_status.assigned} tint="#64748B" />
            <TaskBlock label="In progress" value={data.tasks.by_status.in_progress} tint="#1E40AF" />
            <TaskBlock label="Completed" value={data.tasks.by_status.completed} tint="#10B981" />
            <TaskBlock label="Delayed" value={data.tasks.by_status.delayed} tint="#EF4444" />
          </View>
          <View style={s.deptRow}>
            {Object.entries(data.tasks.by_department).map(([k, v]: any) => (
              <View key={k} style={s.deptPill}>
                <Text style={s.deptText}>{k} · {v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Drill-down department cards */}
        <Text style={s.section}>{isSportsAdmin ? "ALPHA dashboards" : "Department dashboards"}</Text>
        {!isSportsAdmin && (
          <DeptCard testID="dept-school" icon="book" tint="#1E40AF" title="School (PWS)" subtitle={`${data.roster_counts.students} students · ${data.roster_counts.teachers} teachers`} onPress={() => router.push("/department/school")} />
        )}
        <DeptCard testID="dept-sports" icon="award" tint="#EA580C" title="Sports Academy (ALPHA)" subtitle={`${data.roster_counts.players} players · ${data.roster_counts.coaches} coaches`} onPress={() => router.push("/department/sports")} />
        {!isSportsAdmin && (
          <DeptCard testID="dept-hostel" icon="home" tint="#7C3AED" title="Hostel" subtitle={`${data.departments.hostel.residents} residents · ${data.departments.hostel.pending_pass} pending passes`} onPress={() => router.push("/(tabs)/hostel")} />
        )}
        <DeptCard testID="dept-staff" icon="user-check" tint="#BE185D" title={isSportsAdmin ? "ALPHA Staff Attendance" : "Staff Attendance"} subtitle={`${data.roster_counts.staff} staff${isSportsAdmin ? " · ALPHA" : " · PWS & ALPHA"}`} onPress={() => router.push("/staff-attendance")} />
        <DeptCard testID="dept-coach-att" icon="award" tint="#EA580C" title="Coach Attendance" subtitle={`${data.roster_counts.coaches} coaches · ALPHA`} onPress={() => router.push("/coach-attendance")} />
        {(userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA) || userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS)) && (
          <DeptCard testID="dept-fees" icon="inbox" tint="#16A34A" title="Fees Collection (ALPHA)" subtitle="Branch-wise revenue · collect dues" onPress={() => router.push("/fees")} />
        )}
        {userHasPermission(user, Permission.BULK_UPLOAD_USERS) && (
          <DeptCard testID="dept-bulk" icon="upload-cloud" tint="#2563EB" title="Bulk Upload" subtitle="CSV / XLSX players + auto-fees" onPress={() => router.push("/admin/bulk-upload")} />
        )}
        {userHasPermission(user, Permission.APPROVE_REQUESTS) && (
          <DeptCard testID="dept-approvals" icon="check-circle" tint="#D97706" title="Approval Workflow" subtitle="Deactivation, concessions, refunds" onPress={() => router.push("/admin/approvals")} />
        )}
        {isSuper && (
          <DeptCard testID="dept-permissions" icon="shield" tint="#0F766E" title="Permissions & Access Control" subtitle="Super Admin · manage user permissions" onPress={() => router.push("/admin/permissions")} />
        )}

        {(data.roster_counts.deactivated_players ?? 0) > 0 && (
          <>
            <Text style={s.section}>Deactivated players ({data.roster_counts.deactivated_players})</Text>
            <View style={s.deactCard}>
              {(data.deactivated_players || []).map((p: any) => (
                <TouchableOpacity key={p.id} testID={`cc-deact-${p.id}`} style={s.deactRow} onPress={() => router.push(`/manage/player/${p.id}`)}>
                  <View style={s.deactDot}><Feather name="slash" size={12} color="#94A3B8" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.deactName}>{p.name}</Text>
                    <Text style={s.deactMeta}>{p.centre || "—"} · {p.sport || "—"}{p.player_type ? " · " + p.player_type : ""}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}
              <Text style={s.deactHelp}>Tap a player to reactivate</Text>
            </View>
          </>
        )}
        </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value, tint, icon, testID }: any) {
  return (
    <View style={s.kpiCard} testID={testID}>
      <View style={[s.kpiIcon, { backgroundColor: tint + "1A" }]}><Feather name={icon} size={16} color={tint} /></View>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function EntityRow({ label, total, att, icon, tint }: any) {
  const present = att?.present || 0;
  const absent = att?.absent || 0;
  return (
    <View style={s.entityRow}>
      <View style={[s.entityIcon, { backgroundColor: tint + "1A" }]}><Feather name={icon} size={16} color={tint} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.entityLabel}>{label}</Text>
        <Text style={s.entityMeta}>{total} total</Text>
      </View>
      <View style={s.entityCounts}>
        <Mini label="P" value={present} tint="#10B981" />
        <Mini label="A" value={absent} tint="#EF4444" />
      </View>
    </View>
  );
}

function Mini({ label, value, tint }: any) {
  return (
    <View style={[s.mini, { backgroundColor: tint + "1A" }]}>
      <Text style={[s.miniLabel, { color: tint }]}>{label}</Text>
      <Text style={[s.miniValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

function TaskBlock({ label, value, tint }: any) {
  return (
    <View style={s.taskBlock}>
      <Text style={[s.taskValue, { color: tint }]}>{value}</Text>
      <Text style={s.taskLabel}>{label}</Text>
    </View>
  );
}

function DeptCard({ icon, tint, title, subtitle, onPress, testID }: any) {
  return (
    <TouchableOpacity style={s.deptCard} onPress={onPress} testID={testID}>
      <View style={[s.deptIcon, { backgroundColor: tint + "1A" }]}><Feather name={icon} size={20} color={tint} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.deptTitle}>{title}</Text>
        <Text style={s.deptSub}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 10 },
  headerLogo: { width: 44, height: 44 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 28, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5, marginTop: 4 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiCard: { flex: 1, backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  kpiIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  kpiValue: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  kpiLabel: { fontSize: 12, color: "#64748B", marginTop: 2 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 12 },
  section: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginTop: 28, marginBottom: 12 },
  sectionMeta: { fontSize: 12, color: "#94A3B8", fontWeight: "700" },
  alertCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, marginBottom: 8 },
  alertText: { fontSize: 13, fontWeight: "700", flex: 1 },
  entityGrid: { gap: 8 },
  entityRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  entityIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  entityLabel: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  entityMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  entityCounts: { flexDirection: "row", gap: 6 },
  mini: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: "center", minWidth: 32 },
  miniLabel: { fontSize: 9, fontWeight: "800" },
  miniValue: { fontSize: 13, fontWeight: "800" },
  taskCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  taskRow: { flexDirection: "row", justifyContent: "space-around" },
  taskBlock: { alignItems: "center" },
  taskValue: { fontSize: 22, fontWeight: "800" },
  taskLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  deptRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  deptPill: { backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  deptText: { fontSize: 11, color: "#475569", fontWeight: "700" },
  deptCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10 },
  deptIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  deptTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  deptSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  deactCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 6 },
  deactRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10 },
  deactDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  deactName: { fontSize: 13, fontWeight: "700", color: "#475569" },
  deactMeta: { fontSize: 11, color: "#94A3B8", marginTop: 1 },
  deactHelp: { fontSize: 11, color: "#94A3B8", padding: 8, textAlign: "center", fontStyle: "italic" },
});

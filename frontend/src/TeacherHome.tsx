import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, useAuth } from "./auth";
import { LoadingState, ErrorState, EmptyState, getApiError } from "./ScreenStates";
import { useBreakpoint } from "./useBreakpoint";
import { fetchDashboardMvp } from "./dashboardApi";

export default function TeacherHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await fetchDashboardMvp();
      setData(d);
    } catch (e: any) {
      setError(getApiError(e));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  if (!user) return null;

  const classes = data?.assigned_classes || [];
  const att = data?.attendance_today || [];
  const notifs = data?.recent_notifications || [];

  return (
    <SafeAreaView style={s.safe} edges={["top"]} testID="teacher-dashboard">
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {loading && !refreshing ? (
          <LoadingState message="Loading dashboard…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
        <>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>TEACHER DASHBOARD</Text>
            <Text style={s.h1}>{user.name.split(" ")[0]}</Text>
            <Text style={s.sub}>{data?.today || "—"} · {classes.length} class assignment(s)</Text>
          </View>
          <TouchableOpacity testID="teacher-notif" style={s.bellBtn} onPress={() => router.push("/notifications")}>
            <Feather name="bell" size={20} color="#0F172A" />
            {(data?.unread_notifications ?? 0) > 0 && <View style={s.bellDot} />}
          </TouchableOpacity>
        </View>

            <View style={s.kpiRow}>
              <Kpi label="Classes" value={String(classes.length)} tint="#1E40AF" icon="book-open" />
              <Kpi label="Pending marks" value={String(data?.pending_marks_entry ?? 0)} tint="#EA580C" icon="edit-3" onPress={() => router.push("/marks")} />
            </View>

            <Text style={s.section}>Assigned classes</Text>
            {classes.length === 0 ? (
              <EmptyState icon="book-open" title="No classes assigned" message="Your class assignments will appear here once configured by admin." />
            ) : (
              classes.map((c: any) => (
                <View key={`${c.section_id}-${c.subject_id}`} style={s.classCard}>
                  <Text style={s.classTitle}>{c.section_label || c.grade_name}</Text>
                  <Text style={s.classSub}>{c.subject_name}</Text>
                </View>
              ))
            )}

            <Text style={s.section}>Today's attendance</Text>
            {att.length === 0 ? (
              <EmptyState icon="check-square" title="No attendance data" message="Attendance for your sections will show here after marking." />
            ) : (
              att.map((a: any) => (
                <View key={a.section_id} style={s.attRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.attLabel}>{a.section_label}</Text>
                    <Text style={s.attMeta}>{a.marked_today}/{a.total_students} marked</Text>
                  </View>
                  <Text style={[s.attPresent, { color: a.present_today > 0 ? "#10B981" : "#94A3B8" }]}>
                    {a.present_today} present
                  </Text>
                </View>
              ))
            )}

            <Text style={s.section}>Recent notifications</Text>
            {notifs.length === 0 ? (
              <EmptyState icon="bell-off" title="No notifications" message="Recent alerts will appear here." />
            ) : (
              notifs.map((n: any) => (
                <TouchableOpacity key={n.id} style={s.notifCard} onPress={() => router.push("/notifications")}>
                  <Feather name="bell" size={14} color="#64748B" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={s.notifTitle}>{n.title}</Text>
                    <Text style={s.notifMsg} numberOfLines={2}>{n.message}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <Text style={s.section}>Quick actions</Text>
            <View style={s.actions}>
              <Action icon="check-square" label="Attendance" onPress={() => router.push("/(tabs)/attendance")} />
              <Action icon="edit-3" label="Enter marks" onPress={() => router.push("/marks")} />
              <Action icon="list" label="Tasks" onPress={() => router.push("/(tabs)/tasks")} />
            </View>
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({ label, value, tint, icon, onPress }: any) {
  const inner = (
    <View style={[s.kpi, { borderLeftColor: tint }]}>
      <Feather name={icon} size={16} color={tint} />
      <View>
        <Text style={s.kpiVal}>{value}</Text>
        <Text style={s.kpiLbl}>{label}</Text>
      </View>
    </View>
  );
  return onPress ? <TouchableOpacity style={{ flex: 1 }} onPress={onPress}>{inner}</TouchableOpacity> : <View style={{ flex: 1 }}>{inner}</View>;
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
  header: { flexDirection: "row", marginBottom: 16 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: "#1E40AF" },
  h1: { fontSize: 26, fontWeight: "700", color: "#0F172A", marginTop: 4 },
  sub: { fontSize: 12, color: "#64748B", marginTop: 4 },
  bellBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  bellDot: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpi: { flex: 1, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#fff", padding: 14, borderRadius: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: "#E2E8F0" },
  kpiVal: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  kpiLbl: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  section: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 22, marginBottom: 8 },
  empty: { color: "#94A3B8", fontStyle: "italic", fontSize: 13, paddingVertical: 8 },
  classCard: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  classTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  classSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  attRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  attLabel: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  attMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  attPresent: { fontSize: 12, fontWeight: "700" },
  notifCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  notifTitle: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  notifMsg: { fontSize: 12, color: "#64748B", marginTop: 2 },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { flexBasis: "30%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  actionLbl: { fontSize: 11, fontWeight: "600", marginTop: 6, color: "#0F172A" },
});

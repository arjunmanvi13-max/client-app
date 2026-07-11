import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../src/auth";
import { entityLabelsFor, ENTITY_COLORS } from "../../src/parentPortal";
import { LoadingState, ErrorState, EmptyState, getApiError, confirmAction } from "../../src/ScreenStates";
import { useBreakpoint } from "../../src/useBreakpoint";
import { fetchDashboardMvp } from "../../src/dashboardApi";

type Ward = {
  id: string;
  name: string;
  kind: string;
  group?: string;
  sport?: string;
  centre?: string;
  organization: string;
  entities?: string[];
  entity_labels?: { code: string; name: string; short?: string }[];
  is_dual_participation?: boolean;
  today_status?: string | null;
  attendance_30d?: { total: number; present: number; absent: number; pct: number | null };
  recent_attendance?: { date: string; status: string; kind?: string }[];
  outstanding_invoices_total?: number;
  outstanding_invoices_count?: number;
  recent_report_cards?: { id: string; exam_term_name?: string; published_at?: string; section_label?: string }[];
};

type ParentAlert = {
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
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [wards, setWards] = useState<Ward[]>([]);
  const [alerts, setAlerts] = useState<ParentAlert[]>([]);
  const [stored, setStored] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [mvp, a] = await Promise.all([
        fetchDashboardMvp(),
        api.get("/parent/alerts"),
      ]);
      const children = mvp?.children || [];
      setWards(children);
      setAlerts(a.data.computed || []);
      setStored(a.data.stored || []);
    } catch (e: any) {
      setError(getApiError(e, "Could not load parent dashboard."));
      setWards([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (!user) return null;

  const unreadCount = stored.filter((s) => !s.read).length + alerts.length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>PARENT PORTAL</Text>
            <Text style={s.h1}>Hi, {user.name.split(" ")[0]}</Text>
            <Text style={s.sub}>Attendance, marks, fees, invoices and alerts for your children</Text>
          </View>
          <TouchableOpacity testID="parent-notifications" style={s.iconBtn} onPress={() => router.push("/parent/notifications" as any)}>
            <Feather name="bell" size={18} color="#64748B" />
            {unreadCount > 0 && <View style={s.bellDot} />}
          </TouchableOpacity>
          <TouchableOpacity testID="parent-logout" style={s.iconBtn} onPress={() => confirmAction("Sign out?", "You will need to sign in again to access the parent portal.", async () => { await logout(); router.replace("/login"); }, { confirmLabel: "Sign out", destructive: true })}>
            <Feather name="log-out" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <LoadingState message="Loading wards…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : wards.length === 0 ? (
          <EmptyState icon="users" title="No ward linked yet" message="Ask your admin to link your account to your child's record." />
        ) : (
          <>
            <Text style={s.section}>My Wards</Text>
            {wards.map((w) => {
              const todaySt = w.today_status;
              const labels = entityLabelsFor(w);
              return (
                <TouchableOpacity
                  key={w.id}
                  testID={`ward-card-${w.id}`}
                  style={s.wardCard}
                  onPress={() => router.push({ pathname: "/parent/ward/[id]" as any, params: { id: w.id } })}
                >
                  <View style={s.wardRow}>
                    <View style={[s.wardAvatar, { backgroundColor: w.is_dual_participation ? "#E0E7FF" : w.organization === "ALPHA" ? "#FED7AA" : "#DBEAFE" }]}>
                      <Text style={[s.wardAvatarTxt, { color: w.is_dual_participation ? "#4338CA" : w.organization === "ALPHA" ? "#EA580C" : "#2563EB" }]}>
                        {w.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.wardName}>{w.name}</Text>
                      <Text style={s.wardMeta}>
                        {w.kind === "player" ? `${w.sport || ""} · ${w.centre || ""}` : `${w.group || ""}`}
                      </Text>
                      <View style={s.entityRow}>
                        {labels.map((lb) => {
                          const c = ENTITY_COLORS[lb.code] || { bg: "#F1F5F9", fg: "#475569" };
                          return (
                            <View key={lb.code} style={[s.entityPill, { backgroundColor: c.bg }]}>
                              <Text style={[s.entityPillTxt, { color: c.fg }]}>{lb.short || lb.code}</Text>
                            </View>
                          );
                        })}
                        {w.is_dual_participation ? (
                          <Text style={s.dualHint}>School + Sports</Text>
                        ) : null}
                      </View>
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
                      <Text style={[s.statValue, { color: (w.outstanding_invoices_total || 0) > 0 ? "#EF4444" : "#10B981" }]}>
                        {(w.outstanding_invoices_total || 0) > 0 ? `₹${(w.outstanding_invoices_total || 0).toLocaleString("en-IN")}` : "Clear"}
                      </Text>
                      <Text style={s.statLabel}>Invoices</Text>
                    </View>
                    <View style={s.statDivider} />
                    <View style={s.statBlock}>
                      <Text style={[s.statValue, { color: (w.recent_report_cards?.length || 0) > 0 ? "#1E40AF" : "#94A3B8" }]}>
                        {w.recent_report_cards?.length ?? 0}
                      </Text>
                      <Text style={s.statLabel}>Report cards</Text>
                    </View>
                  </View>
                  {(w.recent_attendance?.length || 0) > 0 && (
                    <View style={s.recentAtt}>
                      <Text style={s.recentAttTitle}>Recent attendance</Text>
                      <View style={s.recentAttRow}>
                        {w.recent_attendance!.slice(0, 5).map((r) => (
                          <View key={r.date} style={[s.attDot, { backgroundColor: (STATUS_TINT[r.status] || "#94A3B8") + "22" }]}>
                            <Text style={[s.attDotTxt, { color: STATUS_TINT[r.status] || "#64748B" }]}>{r.date.slice(5)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
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
  iconBtn: { padding: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", position: "relative" },
  bellDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
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
  entityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" },
  entityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  entityPillTxt: { fontSize: 10, fontWeight: "800" },
  dualHint: { fontSize: 10, color: "#64748B", fontWeight: "600" },
  statsRow: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9", alignItems: "center" },
  statBlock: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, height: 26, backgroundColor: "#E2E8F0" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  recentAtt: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  recentAttTitle: { fontSize: 10, fontWeight: "700", color: "#64748B", textTransform: "uppercase", marginBottom: 6 },
  recentAttRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  attDot: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  attDotTxt: { fontSize: 10, fontWeight: "700" },
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

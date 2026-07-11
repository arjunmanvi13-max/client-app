/**
 * ALPHA Sports ERP Dashboard — desktop-first.
 * Three analytics bands: Financial / Attendance / Tasks, plus top filter band.
 * Each cube is clickable to open a drill-down modal (branch → sport → player).
 *
 * Backend: GET /api/alpha-dashboard?centre=&sport=&date_from=&date_to=
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Modal, Pressable, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "./auth";
import { colors } from "./theme";
import { formatDateTime } from "./dateFormat";

const CENTRES = ["Balua", "Harding Park"] as const;
const SPORTS = ["Cricket", "Football"] as const;

type Filters = { centre: string | null; sport: string | null };

type FinancialCube = {
  total: number;
  count: number;
  by_centre: Record<string, { total: number; count: number }>;
  by_centre_sport: Record<string, Record<string, { total: number; count: number }>>;
};

type AttendanceCube = {
  total: { present: number; absent: number; late: number; leave: number; residents?: number };
  by_centre?: Record<string, { present: number; absent: number; late: number; leave: number }>;
  by_centre_sport?: Record<string, Record<string, { present: number; absent: number; late: number; leave: number }>>;
};

type DashData = {
  filters: Filters;
  financial: { collected_today: FinancialCube; due_current_month: FinancialCube; overdue_30plus: FinancialCube };
  attendance: { players: AttendanceCube; coaches: AttendanceCube; hostel: AttendanceCube; staff: AttendanceCube };
  tasks: { pending: number; in_progress: number; completed: number; delayed: number; followup: number; total: number };
  generated_at: string;
};

function inr(n: number) {
  if (!n && n !== 0) return "—";
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n.toLocaleString()}`;
}

export function AlphaERPDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({ centre: null, sport: null });
  const [drill, setDrill] = useState<null | { kind: "financial" | "attendance"; key: string; title: string; data: any; tint: string; icon: keyof typeof Feather.glyphMap }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.centre) params.centre = filters.centre;
      if (filters.sport) params.sport = filters.sport;
      const { data } = await api.get("/alpha-dashboard", { params });
      setData(data);
    } catch (e) { /* noop */ }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  // Live tick every 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Responsive column count
  const cols = width >= 1280 ? 3 : width >= 900 ? 3 : 1;

  const openFinancialDrill = (key: "collected_today" | "due_current_month" | "overdue_30plus") => {
    if (!data) return;
    const titles: any = {
      collected_today: { title: "Fees Collected Today", tint: "#10B981", icon: "trending-up" },
      due_current_month: { title: "Current-Month Fees Due", tint: "#F59E0B", icon: "calendar" },
      overdue_30plus: { title: "Overdue (>30 days)", tint: "#EF4444", icon: "alert-octagon" },
    };
    setDrill({ kind: "financial", key, ...titles[key], data: data.financial[key] });
  };

  const openAttendanceDrill = (key: "players" | "coaches" | "hostel" | "staff") => {
    if (!data) return;
    const titles: any = {
      players: { title: "Players Attendance", tint: "#1D4ED8", icon: "users" },
      coaches: { title: "Coaches Attendance", tint: "#EA580C", icon: "award" },
      hostel: { title: "Hostel Roll-call", tint: "#0E7490", icon: "moon" },
      staff: { title: "ALPHA Staff", tint: "#7C3AED", icon: "briefcase" },
    };
    setDrill({ kind: "attendance", key, ...titles[key], data: data.attendance[key] });
  };

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* HEADER BAND */}
        <View style={s.header}>
          <View>
            <Text style={s.brandLine}>ALPHA SPORTS ACADEMY</Text>
            <Text style={s.h1}>OPERATIONS DASHBOARD</Text>
            <Text style={s.sub}>{user?.name} · {(user?.role || "").replace("_", " ")}</Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity testID="header-notifs" style={s.headerIconBtn} onPress={() => router.push("/notifications")}>
              <Feather name="bell" size={18} color={colors.muted} />
            </TouchableOpacity>
            <View style={s.live}><View style={s.liveDot} /><Text style={s.liveTxt}>LIVE</Text></View>
          </View>
        </View>

        {/* FILTER BAND */}
        <View style={s.filterBand} testID="filter-band">
          <Text style={s.filterLabel}>FILTERS</Text>
          <View style={s.filterRow}>
            <FilterPills label="Centre" value={filters.centre} options={[null, ...CENTRES]} onChange={(v) => setFilters((f) => ({ ...f, centre: v }))} testIDPrefix="filter-centre" />
            <View style={s.filterDivider} />
            <FilterPills label="Sport" value={filters.sport} options={[null, ...SPORTS]} onChange={(v) => setFilters((f) => ({ ...f, sport: v }))} testIDPrefix="filter-sport" />
            <View style={{ flex: 1 }} />
            {(filters.centre || filters.sport) && (
              <Pressable onPress={() => setFilters({ centre: null, sport: null })} testID="filter-clear" style={s.clearBtn}>
                <Feather name="x" size={12} color={colors.muted} />
                <Text style={s.clearTxt}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        </View>

        {loading && !data ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} size="large" />
        ) : !data ? (
          <Text style={s.empty}>Unable to load dashboard.</Text>
        ) : (
          <>
            {/* FINANCIAL BAND */}
            <BandHeader icon="trending-up" title="Financial Overview" subtitle="Real-time fee inflow & outstanding dues" />
            <View style={[s.cubeGrid, { gap: 16 }]}>
              <FinancialCubeCard
                testID="cube-collected-today"
                title="Fees Collected Today"
                value={inr(data.financial.collected_today.total)}
                sub={`${data.financial.collected_today.count} transaction(s)`}
                icon="trending-up"
                tint="#10B981"
                bg="#ECFDF5"
                width={cols === 1 ? "100%" : "32%"}
                onPress={() => openFinancialDrill("collected_today")}
              />
              <FinancialCubeCard
                testID="cube-due-current"
                title="Current Month Dues"
                value={inr(data.financial.due_current_month.total)}
                sub={`${data.financial.due_current_month.count} pending invoice(s)`}
                icon="calendar"
                tint="#F59E0B"
                bg="#FEF3C7"
                width={cols === 1 ? "100%" : "32%"}
                onPress={() => openFinancialDrill("due_current_month")}
              />
              <FinancialCubeCard
                testID="cube-overdue"
                title="Overdue > 30 days"
                value={inr(data.financial.overdue_30plus.total)}
                sub={`${data.financial.overdue_30plus.count} defaulter invoice(s)`}
                icon="alert-octagon"
                tint="#EF4444"
                bg="#FEE2E2"
                width={cols === 1 ? "100%" : "32%"}
                onPress={() => openFinancialDrill("overdue_30plus")}
              />
            </View>

            {/* ATTENDANCE BAND */}
            <BandHeader icon="user-check" title="Attendance Overview" subtitle="Today's live attendance across ALPHA" mt={24} />
            <View style={[s.cubeGrid, { gap: 16 }]}>
              <AttendanceCubeCard
                testID="cube-att-players"
                title="Players"
                tint="#1D4ED8"
                bg="#DBEAFE"
                present={data.attendance.players.total.present || 0}
                absent={data.attendance.players.total.absent || 0}
                width={cols === 1 ? "100%" : "23%"}
                onPress={() => openAttendanceDrill("players")}
                icon="users"
              />
              <AttendanceCubeCard
                testID="cube-att-hostel"
                title="Hostel"
                tint="#0E7490"
                bg="#CFFAFE"
                present={data.attendance.hostel.total.present || 0}
                absent={data.attendance.hostel.total.absent || 0}
                width={cols === 1 ? "100%" : "23%"}
                onPress={() => openAttendanceDrill("hostel")}
                icon="moon"
                extra={`${data.attendance.hostel.total.residents || 0} residents`}
              />
              <AttendanceCubeCard
                testID="cube-att-coaches"
                title="Coaches"
                tint="#EA580C"
                bg="#FED7AA"
                present={data.attendance.coaches.total.present || 0}
                absent={data.attendance.coaches.total.absent || 0}
                width={cols === 1 ? "100%" : "23%"}
                onPress={() => openAttendanceDrill("coaches")}
                icon="award"
              />
              <AttendanceCubeCard
                testID="cube-att-staff"
                title="Staff (ALPHA)"
                tint="#7C3AED"
                bg="#EDE9FE"
                present={data.attendance.staff.total.present || 0}
                absent={data.attendance.staff.total.absent || 0}
                width={cols === 1 ? "100%" : "23%"}
                onPress={() => openAttendanceDrill("staff")}
                icon="briefcase"
              />
            </View>

            {/* TASKS BAND */}
            <BandHeader icon="check-square" title="Task Tracker" subtitle={`${data.tasks.total} total task(s) across ALPHA operations`} mt={24} />
            <View style={[s.cubeGrid, { gap: 12 }]}>
              <TaskCubeCard testID="cube-task-pending" title="Pending" count={data.tasks.pending} tint="#0EA5E9" icon="inbox" width={cols === 1 ? "100%" : "18%"} />
              <TaskCubeCard testID="cube-task-progress" title="In Progress" count={data.tasks.in_progress} tint="#1D4ED8" icon="play" width={cols === 1 ? "100%" : "18%"} />
              <TaskCubeCard testID="cube-task-completed" title="Completed" count={data.tasks.completed} tint="#10B981" icon="check-circle" width={cols === 1 ? "100%" : "18%"} />
              <TaskCubeCard testID="cube-task-delayed" title="Delayed" count={data.tasks.delayed} tint="#EF4444" icon="alert-triangle" width={cols === 1 ? "100%" : "18%"} />
              <TaskCubeCard testID="cube-task-followup" title="Follow-ups" count={data.tasks.followup} tint="#F59E0B" icon="message-circle" width={cols === 1 ? "100%" : "18%"} />
            </View>

            <Text style={s.lastUpdated}>Last updated: {formatDateTime(data.generated_at)}</Text>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DRILL-DOWN MODAL */}
      <Modal visible={!!drill} animationType="fade" transparent onRequestClose={() => setDrill(null)}>
        <View style={s.modalBg}>
          {drill && (
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <View style={[s.modalIconWrap, { backgroundColor: drill.tint }]}>
                  <Feather name={drill.icon} size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>{drill.title}</Text>
                  <Text style={s.modalSub}>Branch → Sport breakdown</Text>
                </View>
                <TouchableOpacity onPress={() => setDrill(null)} testID="drill-close" style={s.modalClose}>
                  <Feather name="x" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4 }}>
                {drill.kind === "financial" ? <FinancialDrill data={drill.data} tint={drill.tint} /> : <AttendanceDrill data={drill.data} tint={drill.tint} />}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Sub-components ---------- */
function BandHeader({ icon, title, subtitle, mt }: { icon: keyof typeof Feather.glyphMap; title: string; subtitle: string; mt?: number }) {
  return (
    <View style={[s.bandHeader, { marginTop: mt ?? 16 }]}>
      <View style={s.bandIcon}><Feather name={icon} size={16} color="#fff" /></View>
      <View>
        <Text style={s.bandTitle}>{title}</Text>
        <Text style={s.bandSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

function FilterPills({ label, value, options, onChange, testIDPrefix }: { label: string; value: string | null; options: (string | null)[]; onChange: (v: string | null) => void; testIDPrefix: string }) {
  return (
    <View style={s.filterCol}>
      <Text style={s.filterColLabel}>{label}</Text>
      <View style={s.pillRow}>
        {options.map((o) => {
          const active = (o ?? "all") === (value ?? "all");
          return (
            <Pressable
              key={o ?? "all"}
              testID={`${testIDPrefix}-${o ?? "all"}`}
              onPress={() => onChange(o)}
              style={[s.pill, active && s.pillActive]}
            >
              <Text style={[s.pillTxt, active && s.pillTxtActive]}>{o ?? "All"}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FinancialCubeCard({ testID, title, value, sub, icon, tint, bg, width, onPress }: any) {
  return (
    <TouchableOpacity testID={testID} style={[s.cube, { width, backgroundColor: "#fff" }]} activeOpacity={0.85} onPress={onPress}>
      <View style={[s.cubeIconWrap, { backgroundColor: bg }]}>
        <Feather name={icon} size={20} color={tint} />
      </View>
      <Text style={s.cubeTitle}>{title}</Text>
      <Text style={[s.cubeValue, { color: tint }]}>{value}</Text>
      <Text style={s.cubeSub}>{sub}</Text>
      <View style={s.cubeCta}>
        <Text style={[s.cubeCtaTxt, { color: tint }]}>View breakdown</Text>
        <Feather name="chevron-right" size={14} color={tint} />
      </View>
    </TouchableOpacity>
  );
}

function AttendanceCubeCard({ testID, title, present, absent, tint, bg, width, onPress, icon, extra }: any) {
  const total = present + absent;
  const pct = total ? Math.round((present / total) * 100) : 0;
  return (
    <TouchableOpacity testID={testID} style={[s.cube, { width, backgroundColor: "#fff" }]} activeOpacity={0.85} onPress={onPress}>
      <View style={[s.cubeIconWrap, { backgroundColor: bg }]}>
        <Feather name={icon} size={20} color={tint} />
      </View>
      <Text style={s.cubeTitle}>{title}</Text>
      <Text style={[s.cubeValue, { color: tint, fontSize: 26 }]}>{pct}%</Text>
      <View style={s.attRow}>
        <View style={s.attCell}><View style={[s.attDot, { backgroundColor: "#10B981" }]} /><Text style={s.attTxt}>Present <Text style={s.attBold}>{present}</Text></Text></View>
        <View style={s.attCell}><View style={[s.attDot, { backgroundColor: "#EF4444" }]} /><Text style={s.attTxt}>Absent <Text style={s.attBold}>{absent}</Text></Text></View>
      </View>
      {extra && <Text style={s.cubeSub}>{extra}</Text>}
      <View style={s.miniBar}><View style={[s.miniBarFill, { backgroundColor: tint, width: `${pct}%` }]} /></View>
    </TouchableOpacity>
  );
}

function TaskCubeCard({ testID, title, count, tint, icon, width }: any) {
  return (
    <View testID={testID} style={[s.taskCube, { width, borderLeftColor: tint }]}>
      <View style={[s.taskIcon, { backgroundColor: tint + "1A" }]}>
        <Feather name={icon} size={16} color={tint} />
      </View>
      <View>
        <Text style={s.taskCount}>{count}</Text>
        <Text style={s.taskTitle}>{title}</Text>
      </View>
    </View>
  );
}

function FinancialDrill({ data, tint }: { data: FinancialCube; tint: string }) {
  const centres = Object.keys(data.by_centre || {});
  return (
    <>
      <Text style={s.drillKpi}>{inr(data.total)} <Text style={s.drillKpiSub}>· {data.count} invoice(s) overall</Text></Text>
      {centres.map((c) => (
        <View key={c} style={s.drillSection}>
          <View style={s.drillSectionHeader}>
            <Feather name="map-pin" size={14} color={tint} />
            <Text style={s.drillSectionTitle}>{c}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[s.drillSectionAmt, { color: tint }]}>{inr(data.by_centre[c].total)}</Text>
          </View>
          <Text style={s.drillCount}>{data.by_centre[c].count} invoice(s)</Text>
          <View style={s.sportRow}>
            {Object.entries(data.by_centre_sport[c] || {}).map(([sport, val]: any) => (
              <View key={sport} style={s.sportCell}>
                <Text style={s.sportName}>{sport}</Text>
                <Text style={[s.sportAmt, { color: tint }]}>{inr(val.total)}</Text>
                <Text style={s.sportCount}>{val.count} inv.</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function AttendanceDrill({ data, tint }: { data: AttendanceCube; tint: string }) {
  const total = data.total;
  const sum = (total.present || 0) + (total.absent || 0);
  const pct = sum ? Math.round((total.present / sum) * 100) : 0;
  const centres = Object.keys(data.by_centre || {});
  return (
    <>
      <View style={s.drillTopRow}>
        <View style={s.drillTopCell}><Text style={[s.drillTopValue, { color: "#10B981" }]}>{total.present || 0}</Text><Text style={s.drillTopLabel}>Present</Text></View>
        <View style={s.drillTopCell}><Text style={[s.drillTopValue, { color: "#EF4444" }]}>{total.absent || 0}</Text><Text style={s.drillTopLabel}>Absent</Text></View>
        <View style={s.drillTopCell}><Text style={[s.drillTopValue, { color: tint }]}>{pct}%</Text><Text style={s.drillTopLabel}>Attendance</Text></View>
      </View>
      {centres.length === 0 && <Text style={s.drillCount}>No branch-level breakdown for this cube.</Text>}
      {centres.map((c) => (
        <View key={c} style={s.drillSection}>
          <View style={s.drillSectionHeader}>
            <Feather name="map-pin" size={14} color={tint} />
            <Text style={s.drillSectionTitle}>{c}</Text>
            <View style={{ flex: 1 }} />
            <Text style={[s.drillSectionAmt, { color: tint }]}>{data.by_centre![c].present} / {data.by_centre![c].present + data.by_centre![c].absent}</Text>
          </View>
          <View style={s.sportRow}>
            {Object.entries(data.by_centre_sport?.[c] || {}).map(([sport, val]: any) => (
              <View key={sport} style={s.sportCell}>
                <Text style={s.sportName}>{sport}</Text>
                <Text style={[s.sportAmt, { color: tint }]}>{val.present} / {val.present + val.absent}</Text>
                <Text style={s.sportCount}>{val.absent > 0 ? `${val.absent} absent` : "All present"}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, paddingBottom: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  brandLine: { fontSize: 11, fontWeight: "800", color: colors.muted, letterSpacing: 2.5 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 4, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, textTransform: "capitalize" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  live: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#DCFCE7", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
  liveTxt: { fontSize: 10, fontWeight: "800", color: "#15803D", letterSpacing: 1 },

  filterBand: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  filterLabel: { fontSize: 10, fontWeight: "800", color: colors.hint, letterSpacing: 1.4, marginBottom: 8 },
  filterRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  filterCol: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterColLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  filterDivider: { width: 1, height: 22, backgroundColor: colors.border },
  pillRow: { flexDirection: "row", gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  pillTxtActive: { color: "#fff" },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 6 },
  clearTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },

  bandHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  bandIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  bandTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, letterSpacing: -0.2 },
  bandSub: { fontSize: 11, color: colors.muted, marginTop: 2 },

  cubeGrid: { flexDirection: "row", flexWrap: "wrap" },

  cube: { padding: 18, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  cubeIconWrap: { width: 44, height: 44, borderRadius: 11, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cubeTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  cubeValue: { fontSize: 32, fontWeight: "800", marginTop: 6, letterSpacing: -1 },
  cubeSub: { fontSize: 11, color: colors.muted, marginTop: 6 },
  cubeCta: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  cubeCtaTxt: { fontSize: 12, fontWeight: "700" },

  attRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  attCell: { flexDirection: "row", alignItems: "center", gap: 4 },
  attDot: { width: 8, height: 8, borderRadius: 4 },
  attTxt: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  attBold: { color: colors.ink, fontWeight: "800" },
  miniBar: { height: 4, backgroundColor: colors.borderSoft, marginTop: 12, borderRadius: 99, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 99 },

  taskCube: { backgroundColor: "#fff", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, flexDirection: "row", alignItems: "center", gap: 10 },
  taskIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  taskCount: { fontSize: 20, fontWeight: "800", color: colors.ink, letterSpacing: -0.5 },
  taskTitle: { fontSize: 11, color: colors.muted, marginTop: 1, fontWeight: "600" },

  empty: { color: colors.muted, textAlign: "center", padding: 30 },
  lastUpdated: { fontSize: 11, color: colors.hint, marginTop: 24, textAlign: "right" },

  // Modal
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, width: "100%", maxWidth: 640, maxHeight: "85%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  modalSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  modalClose: { padding: 6 },

  drillKpi: { fontSize: 22, fontWeight: "800", color: colors.ink, marginBottom: 14 },
  drillKpiSub: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  drillSection: { backgroundColor: colors.surface2, padding: 14, borderRadius: 12, marginBottom: 10 },
  drillSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  drillSectionTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  drillSectionAmt: { fontSize: 14, fontWeight: "800" },
  drillCount: { fontSize: 11, color: colors.muted, marginTop: 4, marginBottom: 8 },
  sportRow: { flexDirection: "row", gap: 8, marginTop: 4, flexWrap: "wrap" },
  sportCell: { flex: 1, minWidth: 120, padding: 10, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  sportName: { fontSize: 11, fontWeight: "700", color: colors.muted },
  sportAmt: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  sportCount: { fontSize: 10, color: colors.hint, marginTop: 2 },
  drillTopRow: { flexDirection: "row", marginBottom: 14, gap: 8 },
  drillTopCell: { flex: 1, padding: 12, backgroundColor: colors.surface2, borderRadius: 10, alignItems: "center" },
  drillTopValue: { fontSize: 22, fontWeight: "800" },
  drillTopLabel: { fontSize: 11, color: colors.muted, marginTop: 4, fontWeight: "600" },
});

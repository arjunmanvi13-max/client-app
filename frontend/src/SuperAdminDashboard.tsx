import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "./auth";
import { LoadingState, ErrorState, getApiError } from "./ScreenStates";
import { formatDate } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import {
  fetchSuperAdminDashboardBundle,
  type DashboardEntity,
  type AttendanceKindStats,
} from "./dashboardApi";
import { colors, radii, shadow } from "./theme";

type Entity = DashboardEntity;

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function kindTotals(stats?: AttendanceKindStats) {
  const present = stats?.present ?? 0;
  const absent = stats?.absent ?? 0;
  const late = stats?.late ?? 0;
  const leave = stats?.leave ?? 0;
  const marked = present + absent + late + leave;
  return { present, absent, late, leave, marked };
}

function pct(marked: number, roster: number) {
  if (!roster) return 0;
  return Math.min(100, Math.round((marked / roster) * 100));
}

function priorityStyle(priority?: string) {
  const p = (priority || "low").toLowerCase();
  if (p === "high" || p === "urgent") return { bg: colors.dangerSoft, fg: "#B91C1C", label: "High" };
  if (p === "medium" || p === "med") return { bg: colors.warningSoft, fg: "#B45309", label: "Med" };
  return { bg: colors.borderSoft, fg: colors.muted, label: "Low" };
}

function formatDueLabel(due?: string) {
  if (!due) return "—";
  const iso = due.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "Today";
  return formatDate(iso);
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth, isWide } = useBreakpoint();
  const [entity, setEntity] = useState<Entity>("both");
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchSuperAdminDashboardBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  const load = useCallback(async () => {
    setError("");
    try {
      const effectiveEntity = isSuperAdmin ? entity : "alpha";
      const d = await fetchSuperAdminDashboardBundle(effectiveEntity);
      setBundle(d);
    } catch (e: any) {
      setError(getApiError(e));
      setBundle(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entity, isSuperAdmin]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const data = bundle?.mvp;
  const metrics = bundle?.metrics;
  const command = bundle?.command;
  const fees = bundle?.fees;
  const openTasks = bundle?.openTasks || [];

  const finance = useMemo(() => {
    const collectedToday = data?.fees_collected_today?.total ?? fees?.collected_today ?? 0;
    const txn = data?.fees_collected_today?.transaction_count ?? 0;
    const monthlyDues = metrics?.aging_dues?.current_month_dues ?? fees?.due_current_month ?? 0;
    const historicalDues = metrics?.aging_dues?.overdue_past_month ?? fees?.due_past ?? data?.outstanding_invoices?.total ?? 0;
    const expectedMonthly = metrics?.revenue?.expected_monthly ?? 0;
    const collectedMonthly = metrics?.revenue?.collected_monthly ?? fees?.received_total ?? collectedToday;
    const collectionGap = metrics?.revenue?.collection_gap ?? Math.max(expectedMonthly - collectedMonthly, 0);
    const received = collectedMonthly;
    const target = Math.max(expectedMonthly || received + monthlyDues + historicalDues, received, 1);
    const progress = Math.min(100, Math.round((received / target) * 100));
    return {
      collectedToday,
      txn,
      monthlyDues,
      historicalDues,
      expectedMonthly,
      collectedMonthly,
      collectionGap,
      received,
      target,
      progress,
      byCategory: metrics?.revenue?.by_category || [],
    };
  }, [data, fees, metrics]);

  const attendanceRows = useMemo(() => {
    const att = command?.attendance_by_kind || {};
    const roster = command?.roster_counts || {};
    const rows: Array<{
      id: string;
      label: string;
      icon: keyof typeof Feather.glyphMap;
      roster: number;
      stats: ReturnType<typeof kindTotals>;
      tint: string;
      pending?: boolean;
    }> = [];

    if (entity !== "alpha") {
      const s = kindTotals(att.student);
      rows.push({
        id: "students",
        label: "Students",
        icon: "book-open",
        roster: roster.students || 0,
        stats: s,
        tint: colors.primary,
        pending: (roster.students || 0) > 0 && s.marked === 0,
      });
    }
    if (entity !== "pws") {
      const p = kindTotals(att.player);
      rows.push({
        id: "players",
        label: "Players",
        icon: "award",
        roster: roster.players || 0,
        stats: p,
        tint: colors.accent,
      });
    }
    if (entity !== "alpha") {
      const t = kindTotals(att.teacher);
      rows.push({
        id: "teachers",
        label: "Teachers",
        icon: "user-check",
        roster: roster.teachers || 0,
        stats: t,
        tint: colors.success,
      });
    }
    if (entity !== "pws") {
      const coachStats = metrics?.attendance_roles?.coaches;
      const c = coachStats
        ? kindTotals(coachStats)
        : kindTotals(att.coach);
      rows.push({
        id: "coaches",
        label: "Coaches",
        icon: "flag",
        roster: coachStats?.roster ?? roster.coaches ?? 0,
        stats: c,
        tint: "#EA580C",
      });
    }
    const staffStats = metrics?.attendance_roles?.staff;
    const staff = staffStats
      ? kindTotals(staffStats)
      : kindTotals(att.staff);
    rows.push({
      id: "staff",
      label: "Support Staff",
      icon: "briefcase",
      roster: staffStats?.roster ?? roster.staff ?? 0,
      stats: staff,
      tint: colors.muted2,
    });
    return rows;
  }, [command, entity, metrics]);

  if (!user) return null;

  const pendingApprovals = metrics?.pending_approvals ?? bundle?.pendingApprovals ?? data?.pending_approvals ?? 0;
  const openTaskCount = metrics?.open_tasks ?? data?.open_tasks ?? openTasks.length;
  const pwsEnrollmentRows = metrics?.pws_enrollment || [];
  const alphaEnrollmentRows = metrics?.alpha_enrollment || [];
  const showPwsEnrollment = entity !== "alpha" && pwsEnrollmentRows.length > 0;
  const showAlphaEnrollment = entity !== "pws" && alphaEnrollmentRows.length > 0;

  const quickActions = [
    { label: "Take attendance", icon: "user-check" as const, href: "/(tabs)/attendance" },
    { label: "Collect fees", icon: "credit-card" as const, href: "/fees/collection" },
    { label: "New task", icon: "plus-square" as const, href: "/task/new" },
    { label: "Reports", icon: "bar-chart-2" as const, href: "/reports" },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]} testID="super-admin-dashboard">
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth,
            alignSelf: contentMaxWidth ? "center" : undefined,
            width: contentMaxWidth ? "100%" : undefined,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={[s.header, isWide && s.headerWide]}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>Dashboard · {formatDate(data?.today)}</Text>
            <Text style={s.h1}>Hello, {user.name.split(" ")[0]}</Text>
            <Text style={s.sub}>{isSuperAdmin ? "Operations snapshot — PWS & ALPHA" : "ALPHA Sports Academy operations"}</Text>
          </View>

          <View style={[s.headerActions, isWide && s.headerActionsWide]}>
            {isSuperAdmin && (
              <View style={s.segment}>
                {(["both", "pws", "alpha"] as Entity[]).map((v) => (
                  <TouchableOpacity
                    key={v}
                    testID={`entity-${v}`}
                    onPress={() => setEntity(v)}
                    style={[s.segmentBtn, entity === v && s.segmentBtnActive]}
                  >
                    <Text style={[s.segmentTxt, entity === v && s.segmentTxtActive]}>
                      {v === "both" ? "Combined" : v.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity testID="quick-action" style={s.quickBtn} onPress={() => setQuickOpen(true)}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={s.quickBtnTxt}>Quick Action</Text>
              <Feather name="chevron-down" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {loading && !refreshing ? (
          <LoadingState message="Loading dashboard…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={s.bento}>
            <View style={[s.topGrid, isWide && s.topGridWide]}>
            {/* Left column — Financial + headcount */}
            <View style={[s.colMain, isWide && s.colMainWide]}>
              <View style={s.card}>
                <View style={s.cardHead}>
                  <Feather name="dollar-sign" size={18} color={colors.hint} />
                  <Text style={s.cardTitle}>Financial Command Center</Text>
                </View>

                <View style={s.financeGrid}>
                  <View style={[s.financeHero, isWide && s.financeHeroWide]}>
                    <View style={s.financeHeroTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.microLabel}>Collection vs outstanding exposure</Text>
                        <Text style={s.heroValue}>
                          {inr(finance.received)} <Text style={s.heroMuted}>collected</Text>
                        </Text>
                      </View>
                      <Text style={s.targetLbl}>Exposure: {inr(finance.target)}</Text>
                    </View>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${finance.progress}%` }]} />
                    </View>
                    <Text style={s.progressCaption}>{finance.progress}% of fee exposure collected</Text>
                  </View>

                  <View style={s.financeRow}>
                    <View style={[s.miniCard, s.miniCardGreen]}>
                      <Text style={s.microLabel}>Daily collection</Text>
                      <Text style={s.miniValueGreen}>{inr(finance.collectedToday)}</Text>
                      <Text style={s.miniHint}>{finance.txn} transactions today</Text>
                    </View>
                    <View style={[s.miniCard, s.miniCardInset]}>
                      <Text style={s.microLabel}>Monthly revenue</Text>
                      <View style={s.dueRow}>
                        <Text style={s.dueLbl}>Expected</Text>
                        <Text style={s.dueVal}>{inr(finance.expectedMonthly)}</Text>
                      </View>
                      <View style={s.dueRow}>
                        <Text style={s.dueLbl}>Collected</Text>
                        <Text style={[s.dueVal, { color: "#047857" }]}>{inr(finance.collectedMonthly)}</Text>
                      </View>
                      <View style={[s.dueRow, { borderBottomWidth: 0 }]}>
                        <Text style={s.dueLbl}>Collection gap</Text>
                        <Text style={[s.dueVal, { color: finance.collectionGap > 0 ? "#D97706" : colors.ink }]}>
                          {inr(finance.collectionGap)}
                        </Text>
                      </View>
                    </View>
                    <View style={[s.miniCard, s.miniCardInset]}>
                      <Text style={s.microLabel}>Aging dues</Text>
                      <View style={s.dueRow}>
                        <Text style={s.dueLbl}>Current month</Text>
                        <Text style={s.dueVal}>{inr(finance.monthlyDues)}</Text>
                      </View>
                      <View style={[s.dueRow, { borderBottomWidth: 0 }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={s.dueLbl}>Overdue (&gt; 1 mo)</Text>
                          <Feather name="alert-triangle" size={11} color={colors.warning} />
                        </View>
                        <Text style={[s.dueVal, { color: "#D97706", fontWeight: "800" }]}>{inr(finance.historicalDues)}</Text>
                      </View>
                    </View>
                  </View>

                  {finance.byCategory.length > 0 && (
                    <View style={s.categoryFinanceList}>
                      {finance.byCategory.filter((row) => row.expected > 0 || row.collected > 0).map((row) => (
                        <View key={row.category} style={s.categoryFinanceRow}>
                          <Text style={s.categoryFinanceLabel}>{row.category}</Text>
                          <Text style={s.categoryFinanceVal}>
                            {inr(row.collected)} / {inr(row.expected)}
                            {row.gap > 0 ? ` · gap ${inr(row.gap)}` : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {(showPwsEnrollment || showAlphaEnrollment) && (
                <View style={s.card}>
                  <View style={s.cardHead}>
                    <Feather name="layers" size={18} color={colors.hint} />
                    <Text style={s.cardTitle}>Enrollment vs capacity</Text>
                  </View>

                  {showPwsEnrollment && (
                    <View style={s.enrollmentBlock}>
                      <Text style={s.enrollmentSectionTitle}>
                        PWS classes · {metrics?.pws_total_active ?? 0}/{metrics?.pws_total_baseline ?? 0} total
                      </Text>
                      <View style={s.enrollmentList}>
                        {pwsEnrollmentRows.filter((row) => row.baseline > 0 || row.active > 0).slice(0, 6).map((row) => (
                          <View key={row.key} style={s.enrollmentRow}>
                            <View style={s.enrollmentTop}>
                              <Text style={s.enrollmentCat}>{row.label}</Text>
                              <Text style={s.enrollmentCount}>{row.active}/{row.baseline || "—"}</Text>
                            </View>
                            {row.baseline > 0 ? (
                              <Text style={[s.enrollmentGap, row.gap === 0 && s.enrollmentGapFull]}>
                                {row.gap > 0 ? `${row.gap} seat${row.gap === 1 ? "" : "s"} available` : "At capacity"}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {showAlphaEnrollment && (
                    <View style={[s.enrollmentBlock, showPwsEnrollment && { marginTop: 10 }]}>
                      <Text style={s.enrollmentSectionTitle}>ALPHA by category & sport</Text>
                      <View style={s.enrollmentList}>
                        {alphaEnrollmentRows.map((row) => (
                          <View key={row.key} style={s.enrollmentRow}>
                            <Text style={s.enrollmentCat}>{row.category}</Text>
                            {(["cricket", "football"] as const).map((sport) => {
                              const cell = row.sports?.[sport];
                              if (!cell) return null;
                              return (
                                <Text key={sport} style={s.enrollmentSportLine}>
                                  {sport.charAt(0).toUpperCase() + sport.slice(1)}: {cell.active}/{cell.baseline || "—"}
                                  {cell.baseline > 0 && cell.gap > 0 ? ` · ${cell.gap} open` : ""}
                                </Text>
                              );
                            })}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <TouchableOpacity onPress={() => router.push("/admin/academy-structure")}>
                    <Text style={s.link}>Configure baselines →</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Pressable
                testID="tile-people"
                style={({ hovered }: any) => [s.headcountBadge, hovered && { opacity: 0.92 }]}
                onPress={() => router.push("/directory")}
              >
                <View style={s.headcountIcon}>
                  <Feather name="users" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.microLabel}>Total active system registry</Text>
                  <Text style={s.headcountValue}>{data?.active_people ?? 0} headcount profiles active</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.primary} />
              </Pressable>
            </View>

            {/* Right column — Attendance matrix */}
            <View style={[s.colSide, isWide && s.colSideWide]}>
              <View style={[s.card, { flex: 1 }]}>
                <View style={s.cardHead}>
                  <Feather name="users" size={18} color={colors.hint} />
                  <Text style={s.cardTitle}>Real-Time Attendance</Text>
                </View>

                <View style={s.attList}>
                  {attendanceRows.map((row) => {
                    const active = row.stats.present + row.stats.late;
                    const width = pct(row.stats.marked, row.roster);
                    return (
                      <View
                        key={row.id}
                        style={[s.attRow, row.pending && s.attRowWarn]}
                      >
                        <View style={s.attRowTop}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Feather name={row.icon} size={14} color={colors.ink2} />
                            <Text style={s.attLabel}>{row.label}</Text>
                          </View>
                          <Text style={s.attRatio}>
                            <Text style={{ color: row.tint, fontWeight: "800" }}>{active}</Text>
                            {" / "}{row.roster}
                          </Text>
                        </View>
                        <View style={s.progressTrack}>
                          <View style={[s.progressFill, { width: `${width}%`, backgroundColor: row.tint }]} />
                        </View>
                        <Text style={s.attMeta}>
                          {row.stats.present} pres · {row.stats.absent} abs · {row.stats.late} late · {row.stats.leave} leave
                        </Text>
                        {row.pending && (
                          <View style={s.pendingPill}>
                            <Feather name="alert-circle" size={10} color="#92400E" />
                            <Text style={s.pendingTxt}>Attendance pending</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {attendanceRows.length === 0 && (
                    <Text style={s.emptyHint}>Attendance breakdown unavailable for this entity filter.</Text>
                  )}
                </View>
              </View>
            </View>
            </View>

            {/* Bottom row — Tasks & Approvals */}
            <View style={[s.colBottom, isWide && s.colBottomWide]}>
              <View style={s.card}>
                <View style={s.cardHeadRow}>
                  <View style={s.cardHead}>
                    <Feather name="check-square" size={16} color={colors.hint} />
                    <Text style={s.cardTitle}>Allocated open tasks ({openTaskCount})</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push("/(tabs)/tasks")}>
                    <Text style={s.link}>View all</Text>
                  </TouchableOpacity>
                </View>

                {openTasks.length === 0 ? (
                  <Text style={s.emptyHint}>No open tasks right now.</Text>
                ) : (
                  <View>
                    {openTasks.slice(0, 3).map((task, idx) => {
                      const pr = priorityStyle(task.priority);
                      return (
                        <TouchableOpacity
                          key={task.id}
                          testID={`task-row-${task.id}`}
                          style={[s.taskRow, idx < openTasks.length - 1 && s.taskRowBorder]}
                          onPress={() => router.push(`/task/${task.id}` as any)}
                        >
                          <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                          <View style={s.taskMeta}>
                            <View style={[s.priorityPill, { backgroundColor: pr.bg }]}>
                              <Text style={[s.priorityTxt, { color: pr.fg }]}>{pr.label}</Text>
                            </View>
                            <Text style={s.taskDue}>{formatDueLabel(task.due_date)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={[s.card, s.approvalsCard]}>
                <View style={s.cardHead}>
                  <Feather name="clock" size={16} color={colors.hint} />
                  <Text style={s.cardTitle}>Pending approvals ({pendingApprovals})</Text>
                </View>

                {pendingApprovals === 0 ? (
                  <View style={s.caughtUp}>
                    <Feather name="check-circle" size={28} color={colors.success} />
                    <Text style={s.caughtUpTitle}>You are completely caught up!</Text>
                    <Text style={s.caughtUpSub}>No organizational approvals require operations signoff.</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={s.approvalCta} onPress={() => router.push("/admin/approvals")}>
                    <Text style={s.approvalCtaTxt}>{pendingApprovals} approval(s) need review</Text>
                    <Feather name="arrow-right" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={quickOpen} transparent animationType="fade" onRequestClose={() => setQuickOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setQuickOpen(false)}>
          <View style={s.quickMenu}>
            <Text style={s.quickMenuTitle}>Quick actions</Text>
            {quickActions.map((a) => (
              <TouchableOpacity
                key={a.href}
                style={s.quickMenuItem}
                onPress={() => { setQuickOpen(false); router.push(a.href as any); }}
              >
                <Feather name={a.icon} size={16} color={colors.primary} />
                <Text style={s.quickMenuTxt}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 20, gap: 16 },
  headerWide: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 20 },
  overline: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.hint, textTransform: "uppercase" },
  h1: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 4 },
  sub: { fontSize: 13, color: colors.muted2, marginTop: 4 },
  headerActions: { gap: 10 },
  headerActionsWide: { alignItems: "flex-end" },
  segment: { flexDirection: "row", backgroundColor: "#CBD5E1", borderRadius: radii.md, padding: 4, ...shadow.sm },
  segmentBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadow.sm },
  segmentTxt: { fontSize: 13, fontWeight: "600", color: colors.muted },
  segmentTxtActive: { color: colors.ink, fontWeight: "700" },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignSelf: "flex-start",
  },
  quickBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  bento: { gap: 16 },
  topGrid: { gap: 16 },
  topGridWide: { flexDirection: "row", alignItems: "stretch" },
  colMain: { gap: 16 },
  colMainWide: { flex: 2 },
  colSide: {},
  colSideWide: { flex: 1 },
  colBottom: { gap: 16 },
  colBottomWide: { flexDirection: "row", width: "100%" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    ...shadow.sm,
    flex: 1,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: colors.muted2, textTransform: "uppercase" },
  financeGrid: { gap: 12 },
  financeHero: { backgroundColor: colors.surface2, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderSoft, padding: 14 },
  financeHeroWide: {},
  financeHeroTop: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  microLabel: { fontSize: 10, fontWeight: "700", color: colors.hint, textTransform: "uppercase", letterSpacing: 0.4 },
  heroValue: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 4 },
  heroMuted: { fontSize: 12, fontWeight: "500", color: colors.muted2 },
  targetLbl: { fontSize: 11, fontWeight: "700", color: colors.hint },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: colors.borderSoft, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 99, backgroundColor: colors.success },
  progressCaption: { marginTop: 6, fontSize: 11, fontWeight: "600", color: colors.success, textAlign: "right" },
  financeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  miniCard: { flex: 1, minWidth: 140, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderSoft, padding: 12 },
  miniCardGreen: { backgroundColor: "#ECFDF5" },
  miniCardInset: { backgroundColor: colors.surface, ...shadow.sm },
  miniValueGreen: { fontSize: 22, fontWeight: "800", color: "#047857", marginTop: 4 },
  miniHint: { fontSize: 11, color: colors.muted2, marginTop: 4 },
  dueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  dueLbl: { fontSize: 11, color: colors.muted2 },
  dueVal: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  headcountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: radii.lg,
    padding: 14,
  },
  headcountIcon: { backgroundColor: colors.primary, borderRadius: radii.md, padding: 8 },
  headcountValue: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 2 },
  attList: { gap: 10 },
  attRow: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radii.md, padding: 10, gap: 6 },
  attRowWarn: { borderColor: "#FDE68A", backgroundColor: "#FFFBEB" },
  attRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  attLabel: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  attRatio: { fontSize: 13, fontWeight: "600", color: colors.muted2 },
  attMeta: { fontSize: 10, color: colors.muted2 },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  pendingTxt: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  link: { fontSize: 12, fontWeight: "700", color: colors.primary },
  taskRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, gap: 10 },
  taskRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  taskTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink2 },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  priorityTxt: { fontSize: 10, fontWeight: "800" },
  taskDue: { fontSize: 11, color: colors.hint },
  approvalsCard: { justifyContent: "space-between" },
  caughtUp: { alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 6 },
  caughtUpTitle: { fontSize: 14, fontWeight: "700", color: colors.ink2 },
  caughtUpSub: { fontSize: 12, color: colors.hint, textAlign: "center", maxWidth: 260 },
  approvalCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primarySofter,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 8,
  },
  approvalCtaTxt: { fontSize: 14, fontWeight: "700", color: colors.primary },
  emptyHint: { fontSize: 12, color: colors.hint, paddingVertical: 8 },
  categoryFinanceList: { gap: 6, marginTop: 4 },
  categoryFinanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  categoryFinanceLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  categoryFinanceVal: { fontSize: 11, fontWeight: "600", color: colors.ink2, flexShrink: 1, textAlign: "right" },
  enrollmentList: { gap: 8 },
  enrollmentBlock: { gap: 6 },
  enrollmentSectionTitle: { fontSize: 11, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.4 },
  enrollmentSportLine: { fontSize: 11, color: colors.muted, marginTop: 2 },
  enrollmentRow: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    padding: 10,
    gap: 6,
  },
  enrollmentTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  enrollmentCat: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  enrollmentCount: { fontSize: 12, fontWeight: "600", color: colors.muted },
  enrollmentGap: { fontSize: 11, fontWeight: "700", color: colors.success },
  enrollmentGapFull: { color: colors.warning },
  enrollmentGapMuted: { fontSize: 11, color: colors.hint },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "flex-start", alignItems: "flex-end", padding: 24, paddingTop: 80 },
  quickMenu: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, minWidth: 220, padding: 8, ...shadow.md },
  quickMenuTitle: { fontSize: 11, fontWeight: "800", color: colors.hint, textTransform: "uppercase", paddingHorizontal: 10, paddingVertical: 8 },
  quickMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radii.sm },
  quickMenuTxt: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
});

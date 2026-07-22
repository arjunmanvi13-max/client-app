import { useState, useCallback, useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  Modal,
  Platform,
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

const PWS_FINANCE_CATEGORIES = new Set(["Day Students", "Boarding Students"]);
const ALPHA_FINANCE_CATEGORIES = new Set(["Day Boarding", "Boarding", "Hostel", "Daily Players"]);

function filterFinanceCategories(
  rows: Array<{ category: string; expected: number; collected: number; gap: number }>,
  entity: Entity,
) {
  if (entity === "pws") {
    return rows.filter((row) => PWS_FINANCE_CATEGORIES.has(row.category));
  }
  if (entity === "alpha") {
    return rows.filter((row) => ALPHA_FINANCE_CATEGORIES.has(row.category));
  }
  return rows;
}

const ZONE = {
  finance: { bg: "#EFF6FF", border: "#BFDBFE", accent: "#2563EB" },
  registry: { bg: "#F0FDF4", border: "#BBF7D0", accent: "#16A34A" },
  people: { bg: "#FAF5FF", border: "#E9D5FF", accent: "#9333EA" },
  workflow: { bg: "#FFFBEB", border: "#FDE68A", accent: "#D97706" },
} as const;

type ZoneKey = keyof typeof ZONE;

function ZoneCard({ zone, style, children }: { zone: ZoneKey; style?: object; children: ReactNode }) {
  const z = ZONE[zone];
  return (
    <View style={[s.zoneCard, { backgroundColor: z.bg, borderColor: z.border, borderLeftColor: z.accent }, style]}>
      {children}
    </View>
  );
}

function CardHead({ icon, title, action }: { icon: keyof typeof Feather.glyphMap; title: string; action?: ReactNode }) {
  return (
    <View style={s.cardHeadRow}>
      <View style={s.cardHead}>
        <Feather name={icon} size={14} color={colors.muted2} />
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export default function SuperAdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth, isWide, height } = useBreakpoint();
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
    const byCategory = filterFinanceCategories(metrics?.revenue?.by_category || [], entity);
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
      byCategory,
    };
  }, [data, fees, metrics, entity]);

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

  const categoryFinanceRows = finance.byCategory.filter((row) => row.expected > 0 || row.collected > 0);

  return (
    <SafeAreaView style={s.safe} edges={["top"]} testID="super-admin-dashboard">
      <ScrollView
        style={isWide ? s.scrollViewport : undefined}
        contentContainerStyle={[
          s.scroll,
          isWide && s.scrollWide,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth,
            alignSelf: contentMaxWidth ? "center" : undefined,
            width: contentMaxWidth ? "100%" : undefined,
            minHeight: isWide ? height - 48 : undefined,
          },
        ]}
        showsVerticalScrollIndicator={!isWide}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={[s.header, isWide && s.headerWide]}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>Dashboard · {formatDate(data?.today)}</Text>
            <Text style={[s.h1, isWide && s.h1Wide]}>Hello, {user.name.split(" ")[0]}</Text>
            {!isWide && (
              <Text style={s.sub}>{isSuperAdmin ? "Operations snapshot — PWS & ALPHA" : "ALPHA Sports Academy operations"}</Text>
            )}
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
              <Feather name="plus" size={15} color="#fff" />
              <Text style={s.quickBtnTxt}>Quick Action</Text>
              <Feather name="chevron-down" size={13} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {loading && !refreshing ? (
          <LoadingState message="Loading dashboard…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={[s.bento, isWide && s.bentoWide]}>
            {/* Row 1 — Financial Command Center */}
            <ZoneCard zone="finance" style={isWide ? s.financeZoneWide : undefined}>
              <CardHead icon="dollar-sign" title="Financial Command Center" />

              <View style={[s.financeTop, isWide && s.financeTopWide]}>
                <View style={s.financeHero}>
                  <View style={s.financeHeroTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.microLabel}>Collection vs exposure</Text>
                      <Text style={s.heroValue}>
                        {inr(finance.received)} <Text style={s.heroMuted}>collected</Text>
                      </Text>
                    </View>
                    <Text style={s.targetLbl}>Exposure {inr(finance.target)}</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${finance.progress}%` }]} />
                  </View>
                  <Text style={s.progressCaption}>{finance.progress}% of fee exposure collected</Text>
                </View>

                <View style={[s.financeMetrics, isWide && s.financeMetricsWide]}>
                  <View style={[s.miniCard, s.miniCardGreen]}>
                    <Text style={s.microLabel}>Daily collection</Text>
                    <Text style={s.miniValueGreen}>{inr(finance.collectedToday)}</Text>
                    <Text style={s.miniHint}>{finance.txn} txn today</Text>
                  </View>
                  <View style={[s.miniCard, s.miniCardInset]}>
                    <Text style={s.microLabel}>Monthly revenue</Text>
                    <View style={s.dueRowCompact}>
                      <Text style={s.dueLbl}>Expected</Text>
                      <Text style={s.dueVal}>{inr(finance.expectedMonthly)}</Text>
                    </View>
                    <View style={s.dueRowCompact}>
                      <Text style={s.dueLbl}>Collected</Text>
                      <Text style={[s.dueVal, s.dueValGreen]}>{inr(finance.collectedMonthly)}</Text>
                    </View>
                    <View style={[s.dueRowCompact, s.dueRowLast]}>
                      <Text style={s.dueLbl}>Gap</Text>
                      <Text style={[s.dueVal, finance.collectionGap > 0 && s.dueValWarn]}>{inr(finance.collectionGap)}</Text>
                    </View>
                  </View>
                  <View style={[s.miniCard, s.miniCardInset]}>
                    <Text style={s.microLabel}>Aging dues</Text>
                    <View style={s.dueRowCompact}>
                      <Text style={s.dueLbl}>Current mo.</Text>
                      <Text style={s.dueVal}>{inr(finance.monthlyDues)}</Text>
                    </View>
                    <View style={[s.dueRowCompact, s.dueRowLast]}>
                      <View style={s.dueLblRow}>
                        <Text style={s.dueLbl}>Overdue</Text>
                        <Feather name="alert-triangle" size={10} color={colors.warning} />
                      </View>
                      <Text style={[s.dueVal, s.dueValWarn, s.dueValBold]}>{inr(finance.historicalDues)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {categoryFinanceRows.length > 0 && (
                <View style={s.duesTable}>
                  <View style={[s.duesTableRow, s.duesTableHead]}>
                    <Text style={[s.duesCell, s.duesCellCat, s.duesHeadTxt]}>Category</Text>
                    <Text style={[s.duesCell, s.duesCellNum, s.duesHeadTxt]}>Collected</Text>
                    <Text style={[s.duesCell, s.duesCellNum, s.duesHeadTxt]}>Expected</Text>
                    <Text style={[s.duesCell, s.duesCellNum, s.duesHeadTxt]}>Gap</Text>
                  </View>
                  {categoryFinanceRows.map((row, idx) => (
                    <View
                      key={row.category}
                      style={[s.duesTableRow, idx < categoryFinanceRows.length - 1 && s.duesTableRowBorder]}
                    >
                      <Text style={[s.duesCell, s.duesCellCat, s.duesCatTxt]} numberOfLines={1}>{row.category}</Text>
                      <Text style={[s.duesCell, s.duesCellNum, s.duesNumTxt]}>{inr(row.collected)}</Text>
                      <Text style={[s.duesCell, s.duesCellNum, s.duesNumMuted]}>{inr(row.expected)}</Text>
                      <Text style={[s.duesCell, s.duesCellNum, row.gap > 0 ? s.duesGapTxt : s.duesNumMuted]}>
                        {inr(row.gap)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </ZoneCard>

            {/* Row 2 — Enrollment + Attendance */}
            <View style={[s.midRow, isWide && s.midRowWide]}>
              <ZoneCard zone="registry" style={s.midCol}>
                {(showPwsEnrollment || showAlphaEnrollment) && (
                  <>
                  <CardHead
                    icon="layers"
                    title="Enrollment vs capacity"
                    action={
                      <TouchableOpacity onPress={() => router.push("/admin/academy-structure")}>
                        <Text style={s.link}>Baselines →</Text>
                      </TouchableOpacity>
                    }
                  />

                  {showPwsEnrollment && (
                    <View style={s.enrollmentBlock}>
                      <Text style={s.enrollmentSectionTitle}>
                        PWS · {metrics?.pws_total_active ?? 0}/{metrics?.pws_total_baseline ?? 0}
                      </Text>
                      <View style={s.enrollmentTable}>
                        {pwsEnrollmentRows.filter((row) => row.baseline > 0 || row.active > 0).slice(0, isWide ? 8 : 5).map((row) => (
                          <View key={row.key} style={s.enrollmentTableRow}>
                            <Text style={s.enrollmentCat} numberOfLines={1}>{row.label}</Text>
                            <Text style={s.enrollmentCount}>
                              {row.active}/{row.baseline || "—"}
                              {row.baseline > 0 && row.gap > 0 ? ` · ${row.gap}` : ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {showAlphaEnrollment && (
                    <View style={[s.enrollmentBlock, showPwsEnrollment && { marginTop: 6 }]}>
                      <Text style={s.enrollmentSectionTitle}>ALPHA · category × sport</Text>
                      {isWide ? (
                        <View style={s.duesTable}>
                          <View style={[s.duesTableRow, s.duesTableHead]}>
                            <Text style={[s.duesCell, s.duesCellCat, s.duesHeadTxt]}>Category</Text>
                            <Text style={[s.duesCell, s.duesCellNum, s.duesHeadTxt]}>Cricket</Text>
                            <Text style={[s.duesCell, s.duesCellNum, s.duesHeadTxt]}>Football</Text>
                          </View>
                          {alphaEnrollmentRows.map((row, idx) => (
                            <View key={row.key} style={[s.duesTableRow, idx < alphaEnrollmentRows.length - 1 && s.duesTableRowBorder]}>
                              <Text style={[s.duesCell, s.duesCellCat, s.duesCatTxt]} numberOfLines={1}>{row.category}</Text>
                              {(["cricket", "football"] as const).map((sport) => {
                                const cell = row.sports?.[sport];
                                return (
                                  <Text key={sport} style={[s.duesCell, s.duesCellNum, s.enrollmentCellTxt]}>
                                    {cell ? `${cell.active}/${cell.baseline || "—"}` : "—"}
                                  </Text>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={s.enrollmentTable}>
                          {alphaEnrollmentRows.map((row) => (
                            <View key={row.key} style={s.enrollmentTableRow}>
                              <Text style={s.enrollmentCat} numberOfLines={1}>{row.category}</Text>
                              <Text style={s.enrollmentCount}>
                                {(["cricket", "football"] as const)
                                  .map((sport) => {
                                    const cell = row.sports?.[sport];
                                    if (!cell) return null;
                                    return `${sport.slice(0, 1).toUpperCase()}${sport.slice(1, 3)} ${cell.active}/${cell.baseline || "—"}`;
                                  })
                                  .filter(Boolean)
                                  .join(" · ")}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                  </>
                )}

                {!showPwsEnrollment && !showAlphaEnrollment && (
                  <CardHead icon="database" title="System registry" />
                )}

                <Pressable
                  testID="tile-people"
                  style={({ hovered }: any) => [
                    s.headcountStrip,
                    !(showPwsEnrollment || showAlphaEnrollment) && { marginTop: 0 },
                    hovered && { opacity: 0.92 },
                  ]}
                  onPress={() => router.push("/directory")}
                >
                  <Feather name="users" size={14} color={ZONE.registry.accent} />
                  <Text style={s.headcountStripTxt}>
                    <Text style={s.headcountStripNum}>{data?.active_people ?? 0}</Text> active registry
                  </Text>
                  <Feather name="chevron-right" size={14} color={ZONE.registry.accent} />
                </Pressable>
              </ZoneCard>

              <ZoneCard zone="people" style={s.midCol}>
                <CardHead icon="users" title="Real-Time Attendance" />

                <View style={s.attList}>
                  {attendanceRows.map((row) => {
                    const active = row.stats.present + row.stats.late;
                    const width = pct(row.stats.marked, row.roster);
                    return (
                      <View key={row.id} style={[s.attRow, row.pending && s.attRowWarn]}>
                        <View style={s.attRowMain}>
                          <View style={s.attRowLeft}>
                            <Feather name={row.icon} size={12} color={row.tint} />
                            <Text style={s.attLabel}>{row.label}</Text>
                          </View>
                          <Text style={s.attRatio}>
                            <Text style={{ color: row.tint, fontWeight: "800" }}>{active}</Text>/{row.roster}
                          </Text>
                        </View>
                        <View style={s.progressTrackThin}>
                          <View style={[s.progressFillThin, { width: `${width}%`, backgroundColor: row.tint }]} />
                        </View>
                        <Text style={s.attMeta} numberOfLines={1}>
                          {row.stats.present}P · {row.stats.absent}A · {row.stats.late}L · {row.stats.leave}Lv
                          {row.pending ? " · pending" : ""}
                        </Text>
                      </View>
                    );
                  })}
                  {attendanceRows.length === 0 && (
                    <Text style={s.emptyHint}>No attendance data for this filter.</Text>
                  )}
                </View>
              </ZoneCard>
            </View>

            {/* Row 3 — Tasks & Approvals */}
            <View style={[s.workflowRow, isWide && s.workflowRowWide]}>
              <ZoneCard zone="workflow" style={s.workflowCol}>
                <CardHead
                  icon="check-square"
                  title={`Open tasks (${openTaskCount})`}
                  action={
                    <TouchableOpacity onPress={() => router.push("/(tabs)/tasks")}>
                      <Text style={s.link}>All →</Text>
                    </TouchableOpacity>
                  }
                />
                {openTasks.length === 0 ? (
                  <Text style={s.emptyHintCompact}>No open tasks.</Text>
                ) : (
                  openTasks.slice(0, isWide ? 2 : 3).map((task, idx) => {
                    const pr = priorityStyle(task.priority);
                    return (
                      <TouchableOpacity
                        key={task.id}
                        testID={`task-row-${task.id}`}
                        style={[s.taskRowCompact, idx > 0 && s.taskRowBorder]}
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
                  })
                )}
              </ZoneCard>

              <ZoneCard zone="workflow" style={s.workflowCol}>
                <CardHead icon="clock" title={`Pending approvals (${pendingApprovals})`} />
                {pendingApprovals === 0 ? (
                  <View style={s.caughtUpCompact}>
                    <Feather name="check-circle" size={16} color={colors.success} />
                    <Text style={s.caughtUpCompactTxt}>All caught up — no approvals pending</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={s.approvalCtaCompact} onPress={() => router.push("/admin/approvals")}>
                    <Text style={s.approvalCtaTxt}>{pendingApprovals} need review</Text>
                    <Feather name="arrow-right" size={14} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </ZoneCard>
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
  scrollViewport: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 100 },
  scrollWide: { paddingVertical: 10, paddingBottom: 12, flexGrow: 1 },
  header: { marginBottom: 12, gap: 10 },
  headerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    marginBottom: 8,
  },
  overline: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: colors.hint, textTransform: "uppercase" },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 2 },
  h1Wide: { fontSize: 20, marginTop: 0 },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  headerActions: { gap: 8 },
  headerActionsWide: { flexDirection: "row", alignItems: "center", gap: 10 },
  segment: { flexDirection: "row", backgroundColor: "#CBD5E1", borderRadius: radii.md, padding: 3, ...shadow.sm },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 6 : 5, borderRadius: 6, minHeight: 32, justifyContent: "center" },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadow.sm },
  segmentTxt: { fontSize: 12, fontWeight: "600", color: colors.muted },
  segmentTxtActive: { color: colors.ink, fontWeight: "700" },
  quickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 8 : 7,
    borderRadius: radii.md,
    minHeight: 40,
    alignSelf: "flex-start",
  },
  quickBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  bento: { gap: 10 },
  bentoWide: { gap: 8, flex: 1 },
  zoneCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: 10,
    ...shadow.sm,
  },
  financeZoneWide: { flexShrink: 0 },
  financeTop: { gap: 8 },
  financeTopWide: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  financeHero: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,0.8)",
    padding: 10,
    flex: 1,
  },
  financeHeroTop: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  financeMetrics: { gap: 6 },
  financeMetricsWide: { flex: 1.4, flexDirection: "row", gap: 6 },
  microLabel: { fontSize: 9, fontWeight: "700", color: colors.hint, textTransform: "uppercase", letterSpacing: 0.4 },
  heroValue: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 2 },
  heroMuted: { fontSize: 11, fontWeight: "500", color: colors.muted2 },
  targetLbl: { fontSize: 10, fontWeight: "700", color: colors.hint, alignSelf: "flex-start" },
  progressTrack: { height: 6, borderRadius: 99, backgroundColor: "rgba(148,163,184,0.35)", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 99, backgroundColor: colors.success },
  progressCaption: { marginTop: 4, fontSize: 10, fontWeight: "600", color: colors.success, textAlign: "right" },
  miniCard: { flex: 1, minWidth: 100, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderSoft, padding: 8 },
  miniCardGreen: { backgroundColor: "#ECFDF5" },
  miniCardInset: { backgroundColor: "rgba(255,255,255,0.7)" },
  miniValueGreen: { fontSize: 16, fontWeight: "800", color: "#047857", marginTop: 2 },
  miniHint: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  dueRowCompact: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  dueRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  dueLblRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  dueLbl: { fontSize: 10, color: colors.muted2 },
  dueVal: { fontSize: 11, fontWeight: "700", color: colors.ink2 },
  dueValGreen: { color: "#047857" },
  dueValWarn: { color: "#D97706" },
  dueValBold: { fontWeight: "800" },
  duesTable: {
    marginTop: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: "rgba(255,255,255,0.55)",
    overflow: "hidden",
  },
  duesTableHead: { backgroundColor: "rgba(241,245,249,0.9)" },
  duesTableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8 },
  duesTableRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  duesCell: { fontSize: 10 },
  duesCellCat: { flex: 1.2, paddingRight: 6 },
  duesCellNum: { flex: 0.8, textAlign: "right" },
  duesHeadTxt: { fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.3 },
  duesCatTxt: { fontWeight: "700", color: colors.ink2 },
  duesNumTxt: { fontWeight: "700", color: colors.ink },
  duesNumMuted: { fontWeight: "600", color: colors.muted2 },
  duesGapTxt: { fontWeight: "800", color: "#D97706" },
  midRow: { gap: 8 },
  midRowWide: { flexDirection: "row", alignItems: "stretch", flex: 1, minHeight: 0 },
  midCol: { flex: 1 },
  midColFull: { flex: 1 },
  enrollmentBlock: { gap: 4 },
  enrollmentSectionTitle: { fontSize: 9, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.4 },
  enrollmentTable: { gap: 2 },
  enrollmentTableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)",
  },
  enrollmentCellTxt: { fontWeight: "700", color: colors.ink2 },
  enrollmentCat: { flex: 1, fontSize: 11, fontWeight: "700", color: colors.ink2 },
  enrollmentCount: { fontSize: 10, fontWeight: "600", color: colors.muted, textAlign: "right" },
  headcountStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  headcountStripTxt: { flex: 1, fontSize: 11, fontWeight: "600", color: colors.ink2 },
  headcountStripNum: { fontWeight: "800", color: "#16A34A", fontSize: 13 },
  attList: { gap: 4 },
  attRow: {
    borderWidth: 1,
    borderColor: "rgba(233,213,255,0.8)",
    borderRadius: radii.sm,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  attRowWarn: { borderColor: "#FDE68A", backgroundColor: "#FFFBEB" },
  attRowMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  attRowLeft: { flexDirection: "row", alignItems: "center", gap: 5 },
  attLabel: { fontSize: 11, fontWeight: "700", color: colors.ink2 },
  attRatio: { fontSize: 11, fontWeight: "600", color: colors.muted2 },
  progressTrackThin: { height: 4, borderRadius: 99, backgroundColor: "rgba(148,163,184,0.3)", overflow: "hidden" },
  progressFillThin: { height: 4, borderRadius: 99 },
  attMeta: { fontSize: 9, color: colors.muted2 },
  workflowRow: { gap: 8 },
  workflowRowWide: { flexDirection: "row", flexShrink: 0 },
  workflowCol: { flex: 1 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 0 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  cardTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, color: colors.muted2, textTransform: "uppercase" },
  link: { fontSize: 11, fontWeight: "700", color: colors.primary },
  taskRowCompact: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5, gap: 8 },
  taskRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  taskTitle: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.ink2 },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  priorityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  priorityTxt: { fontSize: 9, fontWeight: "800" },
  taskDue: { fontSize: 10, color: colors.hint },
  caughtUpCompact: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  caughtUpCompactTxt: { fontSize: 11, fontWeight: "600", color: colors.ink2, flex: 1 },
  approvalCtaCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  approvalCtaTxt: { fontSize: 12, fontWeight: "700", color: colors.primary },
  emptyHint: { fontSize: 11, color: colors.hint, paddingVertical: 4 },
  emptyHintCompact: { fontSize: 11, color: colors.hint, paddingVertical: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "flex-start", alignItems: "flex-end", padding: 24, paddingTop: 80 },
  quickMenu: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, minWidth: 220, padding: 8, ...shadow.md },
  quickMenuTitle: { fontSize: 11, fontWeight: "800", color: colors.hint, textTransform: "uppercase", paddingHorizontal: 10, paddingVertical: 8 },
  quickMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radii.sm },
  quickMenuTxt: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
});

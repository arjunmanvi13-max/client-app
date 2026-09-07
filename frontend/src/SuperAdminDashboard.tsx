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
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth, api } from "./auth";
import { LoadingState, ErrorState, getApiError } from "./ScreenStates";
import { formatDate, toISODate } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import {
  fetchSuperAdminDashboardBundle,
  type DashboardEntity,
  type FinanceBucket,
} from "./dashboardApi";
import { orgDashboardSubtitle, isAccountsDashboardRole } from "./dashboardRouting";
import { colors, radii, shadow } from "./theme";
import { RadialGauge } from "./dashboard/RadialGauge";
import { EnrollmentCapacityChart } from "./dashboard/EnrollmentCapacityChart";
import { financialSummary } from "./approvalTypes";
import type { ApprovalRequest } from "./approvalTypes";
import { approveExpenseEntry, rejectExpenseEntry } from "./expenses/expenseApi";
import { formatInr } from "./expenses/expenseFormat";
import { isTaskOverdue, taskDueDate, type TaskRecord } from "./components/tasks/taskTypes";

type Entity = DashboardEntity;
type ApprovalTab = "waivers" | "onboardings" | "expenses";
type TaskTab = "overdue" | "today" | "progress";

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function formatDueLabel(due?: string) {
  if (!due) return "—";
  const iso = due.slice(0, 10);
  const today = toISODate();
  if (iso === today) return "Today";
  return formatDate(iso);
}

function recoveryTone(pct: number) {
  if (pct >= 80) return { fg: "#047857", track: "#D1FAE5", fill: "#059669" };
  if (pct >= 50) return { fg: "#B45309", track: "#FEF3C7", fill: "#D97706" };
  return { fg: "#B91C1C", track: "#FEE2E2", fill: "#DC2626" };
}

function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
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

function FinanceColumn({
  title,
  accent,
  bucket,
  emphasize,
}: {
  title: string;
  accent: string;
  bucket: FinanceBucket;
  emphasize: boolean;
}) {
  const target = Math.max(bucket.collected + bucket.dues, 1);
  const pct = Math.min(100, Math.round((bucket.collected / target) * 100));
  const tone = recoveryTone(pct);
  return (
    <View style={[s.finCol, emphasize ? s.finColHot : s.finColDim, { borderTopColor: accent }]} testID={`finance-col-${title}`}>
      <Text style={[s.finOrg, { color: accent }]}>{title}</Text>
      <Text style={s.finCollected}>{inr(bucket.collected)}</Text>
      <Text style={s.finMeta}>collected</Text>
      <View style={s.finDueRow}>
        <Text style={s.finDueLbl}>Dues</Text>
        <Text style={s.finDueVal}>{inr(bucket.dues)}</Text>
      </View>
      <View style={[s.progressTrack, { backgroundColor: tone.track }]}>
        <View style={[s.progressFill, { width: `${pct}%`, backgroundColor: tone.fill }]} />
      </View>
      <Text style={[s.progressCaption, { color: tone.fg }]}>{pct}% recovered</Text>
      <Text style={s.finToday}>Today {inr(bucket.collectedToday)} · {bucket.txnToday} txn</Text>
    </View>
  );
}

type DashboardProps = {
  lockedEntity?: Entity;
};

export default function SuperAdminDashboard({ lockedEntity }: DashboardProps = {}) {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, isWide, height } = useBreakpoint();
  const [entity, setEntity] = useState<Entity>(lockedEntity || "both");
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchSuperAdminDashboardBundle>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [approvalTab, setApprovalTab] = useState<ApprovalTab>("waivers");
  const [taskTab, setTaskTab] = useState<TaskTab>("overdue");
  const [busyId, setBusyId] = useState<string | null>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const isAccountsRole = isAccountsDashboardRole(user?.role);
  const effectiveEntity: Entity = lockedEntity ?? (isSuperAdmin ? entity : "alpha");
  const lockedSubtitle =
    lockedEntity === "pws" || lockedEntity === "alpha"
      ? orgDashboardSubtitle(user?.role, lockedEntity)
      : null;

  const load = useCallback(async () => {
    setError("");
    try {
      const d = await fetchSuperAdminDashboardBundle(effectiveEntity);
      setBundle(d);
    } catch (e: any) {
      setError(getApiError(e));
      setBundle(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveEntity]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const data = bundle?.mvp;
  const metrics = bundle?.metrics;
  const command = bundle?.command;
  const finance = bundle?.financeByEntity;
  const openTasks = bundle?.openTasks || [];
  const pendingRows = bundle?.pendingApprovalRows || [];
  const expenseRows = bundle?.expenseApprovals || [];

  const waivers = pendingRows.filter((r) => ["fee_concession", "fee_edit", "refund"].includes(r.category));
  const onboardings = pendingRows.filter((r) => r.category === "fee_override_admission");
  const approvalCounts = {
    waivers: waivers.length,
    onboardings: onboardings.length,
    expenses: expenseRows.length,
  };

  const taskBuckets = useMemo(() => {
    const today = toISODate();
    const overdue: TaskRecord[] = [];
    const dueToday: TaskRecord[] = [];
    const inProgress: TaskRecord[] = [];
    for (const task of openTasks) {
      const due = taskDueDate(task)?.slice(0, 10);
      if (isTaskOverdue(task)) overdue.push(task);
      else if (due === today) dueToday.push(task);
      else inProgress.push(task);
    }
    return { overdue, today: dueToday, progress: inProgress };
  }, [openTasks]);

  const campusRows = (command?.attendance_by_campus || []).filter((row) => {
    if (effectiveEntity === "pws") return (row.organization || "").toUpperCase() === "PWS";
    if (effectiveEntity === "alpha") return (row.organization || "").toUpperCase() === "ALPHA";
    return true;
  });

  const attendancePct = useMemo(() => {
    if (command?.kpis?.attendance_pct_today != null) return command.kpis.attendance_pct_today;
    const roster = campusRows.reduce((n, r) => n + (r.roster || 0), 0);
    const checkins = campusRows.reduce((n, r) => n + (r.checkins || 0), 0);
    if (!roster) return 0;
    return Math.min(100, Math.round((checkins / roster) * 100));
  }, [command, campusRows]);

  const chartRows = (metrics?.campus_capacity || []).filter((row) => {
    if (effectiveEntity === "pws") return row.entity === "PWS";
    if (effectiveEntity === "alpha") return row.entity === "ALPHA";
    return true;
  });
  const alerts = (metrics?.capacity_alerts || []).filter((row) => {
    if (effectiveEntity === "pws") return row.entity === "PWS";
    if (effectiveEntity === "alpha") return row.entity === "ALPHA";
    return true;
  });

  if (!user) return null;

  const quickActions = [
    ...(!isAccountsRole
      ? [{ label: "Take attendance", icon: "user-check" as const, href: "/(tabs)/attendance" }]
      : []),
    { label: "Collect fees", icon: "credit-card" as const, href: "/fees/collection" },
    { label: "New task", icon: "plus-square" as const, href: "/task/new" },
    { label: "Reports", icon: "bar-chart-2" as const, href: "/reports" },
  ];

  const decideApproval = async (req: ApprovalRequest, action: "approve" | "reject") => {
    setBusyId(req.id);
    try {
      await api.post(`/approval-requests/${req.id}/${action}`, {
        note: action === "reject" ? "Rejected from dashboard" : undefined,
      });
      await load();
    } catch (e) {
      Alert.alert("Could not save decision", getApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const decideExpense = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    try {
      if (action === "approve") await approveExpenseEntry(id);
      else await rejectExpenseEntry(id, "Rejected from dashboard");
      await load();
    } catch (e) {
      Alert.alert("Could not save decision", getApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const shownApprovals = approvalTab === "waivers" ? waivers : approvalTab === "onboardings" ? onboardings : [];
  const shownTasks = taskTab === "overdue" ? taskBuckets.overdue : taskTab === "today" ? taskBuckets.today : taskBuckets.progress;

  return (
    <SafeAreaView style={s.safe} edges={["top"]} testID="super-admin-dashboard">
      <ScrollView
        style={isWide ? s.scrollViewport : undefined}
        contentContainerStyle={[
          s.scroll,
          isWide && s.scrollWide,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: isWide ? 1280 : undefined,
            alignSelf: "center",
            width: "100%",
            minHeight: isWide ? height - 48 : undefined,
          },
        ]}
        showsVerticalScrollIndicator={!isWide}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={[s.header, isWide && s.headerWide]}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>Dashboard · {formatDate(data?.today)}</Text>
            <Text style={[s.h1, isWide && s.h1Wide]}>Hello, {user.name.split(" ")[0]}</Text>
            {!isWide && (
              <Text style={s.sub}>
                {lockedSubtitle
                  ?? (isSuperAdmin ? "Operations snapshot — PWS & ALPHA" : "Operations snapshot")}
              </Text>
            )}
          </View>

          <View style={[s.headerActions, isWide && s.headerActionsWide]}>
            {isSuperAdmin && !lockedEntity && (
              <View style={s.segment} testID="entity-toggle">
                {(["pws", "alpha", "both"] as Entity[]).map((v) => (
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

            {lockedEntity && (
              <View style={s.scopeBadge}>
                <Text style={s.scopeBadgeTxt}>{lockedEntity.toUpperCase()}</Text>
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
          <View style={s.stack}>
            <View style={[s.finBanner, isWide && s.finBannerWide]} testID="finance-summary">
              <FinanceColumn
                title="PWS"
                accent={colors.primary}
                bucket={finance?.pws || emptyBucket()}
                emphasize={effectiveEntity !== "alpha"}
              />
              <FinanceColumn
                title="ALPHA"
                accent={colors.accent}
                bucket={finance?.alpha || emptyBucket()}
                emphasize={effectiveEntity !== "pws"}
              />
              <View style={[s.finCol, s.finCombined, effectiveEntity === "both" && s.finColHot]} testID="finance-col-Combined">
                <Text style={s.finOrg}>Combined</Text>
                <Text style={s.finCollected}>{inr(finance?.combined.collected || 0)}</Text>
                <Text style={s.finMeta}>total revenue collected</Text>
                <View style={s.recoveryBox}>
                  <Text style={s.recoveryLbl}>Recovery rate</Text>
                  <Text style={[s.recoveryVal, { color: recoveryTone(finance?.combined.recoveryPct || 0).fg }]}>
                    {finance?.combined.recoveryPct || 0}%
                  </Text>
                </View>
                <View style={[s.progressTrack, { backgroundColor: recoveryTone(finance?.combined.recoveryPct || 0).track }]}>
                  <View
                    style={[
                      s.progressFill,
                      {
                        width: `${finance?.combined.recoveryPct || 0}%`,
                        backgroundColor: recoveryTone(finance?.combined.recoveryPct || 0).fill,
                      },
                    ]}
                  />
                </View>
                <Text style={s.finToday}>Outstanding {inr(finance?.combined.dues || 0)}</Text>
              </View>
            </View>

            <View style={[s.midRow, isWide && s.midRowWide]}>
              <Card style={s.midCol}>
                <CardHead icon="activity" title="Real-time attendance" />
                <View style={[s.attHero, isWide && s.attHeroWide]}>
                  <RadialGauge percent={attendancePct} label="Checked in" />
                  <View style={s.campusList}>
                    {campusRows.length === 0 ? (
                      <Text style={s.emptyHint}>No campus check-ins yet today.</Text>
                    ) : (
                      campusRows.map((row) => {
                        const pct = row.roster ? Math.round((row.checkins / row.roster) * 100) : 0;
                        const alpha = (row.organization || "").toUpperCase() === "ALPHA";
                        return (
                          <View key={row.campus} style={s.campusRow} testID={`campus-att-${row.campus}`}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.campusName}>{row.campus}</Text>
                              <Text style={s.campusMeta}>
                                {row.checkins} live check-ins · roster {row.roster}
                              </Text>
                            </View>
                            <View style={[s.campusPct, { backgroundColor: alpha ? colors.accentSoft : colors.primarySofter }]}>
                              <Text style={[s.campusPctTxt, { color: alpha ? colors.accent : colors.primary }]}>{pct}%</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              </Card>

              <Card style={s.midCol}>
                <CardHead
                  icon="clock"
                  title="Pending approvals"
                  action={
                    <TouchableOpacity onPress={() => router.push("/admin/approvals")}>
                      <Text style={s.link}>Queue →</Text>
                    </TouchableOpacity>
                  }
                />
                <View style={s.tabs}>
                  {([
                    ["waivers", "Fee Waivers", approvalCounts.waivers],
                    ["onboardings", "New Onboardings", approvalCounts.onboardings],
                    ["expenses", "Expense Requests", approvalCounts.expenses],
                  ] as const).map(([key, label, count]) => (
                    <TouchableOpacity
                      key={key}
                      testID={`approval-tab-${key}`}
                      onPress={() => setApprovalTab(key)}
                      style={[s.tab, approvalTab === key && s.tabActive]}
                    >
                      <Text style={[s.tabTxt, approvalTab === key && s.tabTxtActive]}>{label}</Text>
                      <View style={[s.countPill, approvalTab === key && s.countPillActive]}>
                        <Text style={[s.countTxt, approvalTab === key && s.countTxtActive]}>{count}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {approvalTab === "expenses" ? (
                  expenseRows.length === 0 ? (
                    <CaughtUp />
                  ) : (
                    expenseRows.slice(0, 6).map((row) => (
                      <View key={row.id} style={s.queueCard} testID={`expense-card-${row.id}`}>
                        <Text style={s.queueTitle} numberOfLines={1}>
                          {row.sub_category || row.expense_head_name || "Expense"}
                        </Text>
                        <Text style={s.queueMeta}>
                          {row.entity_id?.toUpperCase()} · {formatInr(row.amount)} · {row.created_by_name}
                        </Text>
                        <QueueActions
                          id={row.id}
                          busy={busyId === row.id}
                          onApprove={() => decideExpense(row.id, "approve")}
                          onReject={() => decideExpense(row.id, "reject")}
                        />
                      </View>
                    ))
                  )
                ) : shownApprovals.length === 0 ? (
                  <CaughtUp />
                ) : (
                  shownApprovals.slice(0, 6).map((req) => (
                    <View key={req.id} style={s.queueCard} testID={`approval-card-${req.id}`}>
                      <Text style={s.queueTitle} numberOfLines={1}>{req.targetUserName}</Text>
                      <Text style={s.queueMeta} numberOfLines={2}>
                        {req.entity} · {financialSummary(req).slice(0, 2).join(" · ") || req.requestedBy}
                      </Text>
                      <QueueActions
                        id={req.id}
                        busy={busyId === req.id}
                        onApprove={() => decideApproval(req, "approve")}
                        onReject={() => decideApproval(req, "reject")}
                      />
                    </View>
                  ))
                )}
              </Card>
            </View>

            <Card>
              <CardHead
                icon="check-square"
                title="Task tracker"
                action={
                  <TouchableOpacity onPress={() => router.push("/(tabs)/tasks")}>
                    <Text style={s.link}>All →</Text>
                  </TouchableOpacity>
                }
              />
              <View style={s.tabs}>
                {([
                  ["overdue", "Overdue", taskBuckets.overdue.length],
                  ["today", "Due Today", taskBuckets.today.length],
                  ["progress", "In Progress", taskBuckets.progress.length],
                ] as const).map(([key, label, count]) => (
                  <TouchableOpacity
                    key={key}
                    testID={`task-tab-${key}`}
                    onPress={() => setTaskTab(key)}
                    style={[s.tab, taskTab === key && s.tabActive, key === "overdue" && count > 0 && taskTab !== key && s.tabWarn]}
                  >
                    <Text style={[s.tabTxt, taskTab === key && s.tabTxtActive]}>{label}</Text>
                    <View style={[s.countPill, taskTab === key && s.countPillActive, key === "overdue" && count > 0 && s.countPillWarn]}>
                      <Text style={[s.countTxt, taskTab === key && s.countTxtActive]}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {shownTasks.length === 0 ? (
                <Text style={s.emptyHint}>No tasks in this bucket.</Text>
              ) : (
                shownTasks.slice(0, 8).map((task) => {
                  const overdue = isTaskOverdue(task);
                  const campus = (task.entity_id || "both").toUpperCase();
                  return (
                    <TouchableOpacity
                      key={task.id}
                      testID={`task-row-${task.id}`}
                      style={s.taskRow}
                      onPress={() => router.push(`/task/${task.id}` as any)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                        <View style={s.taskMeta}>
                          <Text style={s.taskAssignee}>{task.assignee_name || "Unassigned"}</Text>
                          <View style={[s.campusTag, campus === "ALPHA" ? s.tagAlpha : s.tagPws]}>
                            <Text style={[s.campusTagTxt, campus === "ALPHA" ? s.tagAlphaTxt : s.tagPwsTxt]}>{campus}</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[s.taskDue, overdue && s.taskDueOverdue]}>{formatDueLabel(taskDueDate(task))}</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </Card>

            <Card>
              <CardHead
                icon="layers"
                title="Enrollment vs capacity"
                action={
                  <TouchableOpacity onPress={() => router.push("/admin/academy-structure")}>
                    <Text style={s.link}>Baselines →</Text>
                  </TouchableOpacity>
                }
              />
              {alerts.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.alertRow}>
                  {alerts.map((row) => (
                    <View key={row.key} style={[s.alertCard, (row.utilization_pct || 0) >= 100 && s.alertCardHot]} testID={`capacity-alert-${row.key}`}>
                      <Text style={s.alertPct}>{row.utilization_pct}%</Text>
                      <Text style={s.alertCampus} numberOfLines={1}>{row.campus}</Text>
                      <Text style={s.alertSport} numberOfLines={2}>{row.sport} · {row.enrolled}/{row.capacity}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
              <EnrollmentCapacityChart rows={chartRows} />
              <Pressable
                testID="tile-people"
                style={({ hovered }: any) => [s.headcountStrip, hovered && { opacity: 0.92 }]}
                onPress={() => router.push("/directory")}
              >
                <Feather name="users" size={14} color="#059669" />
                <Text style={s.headcountStripTxt}>
                  <Text style={s.headcountStripNum}>{data?.active_people ?? 0}</Text> active registry
                </Text>
                <Feather name="chevron-right" size={14} color="#059669" />
              </Pressable>
            </Card>
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

function emptyBucket(): FinanceBucket {
  return { collected: 0, dues: 0, collectedToday: 0, txnToday: 0, recoveryPct: 0 };
}

function CaughtUp() {
  return (
    <View style={s.caughtUp}>
      <Feather name="check-circle" size={16} color="#059669" />
      <Text style={s.caughtUpTxt}>All caught up</Text>
    </View>
  );
}

function QueueActions({
  id,
  busy,
  onApprove,
  onReject,
}: {
  id: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={s.queueActions}>
      <TouchableOpacity style={[s.btnApprove, busy && s.btnDisabled]} disabled={busy} onPress={onApprove} testID={`btn-approve-${id}`}>
        <Text style={s.btnApproveTxt}>Approve</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.btnReject, busy && s.btnDisabled]} disabled={busy} onPress={onReject} testID={`btn-reject-${id}`}>
        <Text style={s.btnRejectTxt}>Reject</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollViewport: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 100 },
  scrollWide: { paddingVertical: 12, paddingBottom: 24, flexGrow: 1 },
  header: { marginBottom: 14, gap: 10 },
  headerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  overline: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, color: colors.hint, textTransform: "uppercase" },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 2 },
  h1Wide: { fontSize: 22, marginTop: 0 },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  headerActions: { gap: 8 },
  headerActionsWide: { flexDirection: "row", alignItems: "center", gap: 10 },
  segment: { flexDirection: "row", backgroundColor: "#E2E8F0", borderRadius: radii.md, padding: 3, ...shadow.sm },
  segmentBtn: { paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 6 : 5, borderRadius: 6, minHeight: 32, justifyContent: "center" },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadow.sm },
  segmentTxt: { fontSize: 12, fontWeight: "600", color: colors.muted },
  segmentTxtActive: { color: colors.ink, fontWeight: "700" },
  scopeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  scopeBadgeTxt: { fontSize: 11, fontWeight: "800", color: colors.primary, letterSpacing: 0.6 },
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
  stack: { gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadow.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, color: colors.muted2, textTransform: "uppercase" },
  link: { fontSize: 11, fontWeight: "700", color: colors.primary },
  finBanner: { gap: 10 },
  finBannerWide: { flexDirection: "row", alignItems: "stretch" },
  finCol: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    padding: 14,
    ...shadow.md,
  },
  finColHot: { opacity: 1 },
  finColDim: { opacity: 0.72 },
  finCombined: { borderTopColor: "#0F172A", backgroundColor: "#F8FAFC" },
  finOrg: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase", color: colors.ink },
  finCollected: { fontSize: 22, fontWeight: "800", color: "#047857", marginTop: 6 },
  finMeta: { fontSize: 11, color: colors.muted2, marginTop: 2 },
  finDueRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, marginBottom: 8 },
  finDueLbl: { fontSize: 12, fontWeight: "600", color: "#B45309" },
  finDueVal: { fontSize: 13, fontWeight: "800", color: "#B45309" },
  progressTrack: { height: 8, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 99 },
  progressCaption: { marginTop: 6, fontSize: 11, fontWeight: "700", textAlign: "right" },
  finToday: { marginTop: 6, fontSize: 10, color: colors.hint, fontWeight: "600" },
  recoveryBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, marginBottom: 8 },
  recoveryLbl: { fontSize: 12, fontWeight: "600", color: colors.muted },
  recoveryVal: { fontSize: 22, fontWeight: "800" },
  midRow: { gap: 10 },
  midRowWide: { flexDirection: "row", alignItems: "stretch" },
  midCol: { flex: 1 },
  attHero: { gap: 12, alignItems: "center" },
  attHeroWide: { flexDirection: "row", alignItems: "flex-start" },
  campusList: { flex: 1, width: "100%", gap: 8 },
  campusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface2,
  },
  campusName: { fontSize: 13, fontWeight: "800", color: colors.ink2 },
  campusMeta: { fontSize: 11, color: colors.muted2, marginTop: 2 },
  campusPct: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  campusPctTxt: { fontSize: 12, fontWeight: "800" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primarySofter, borderColor: "#BFDBFE" },
  tabWarn: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  tabTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  tabTxtActive: { color: colors.primary },
  countPill: { minWidth: 18, paddingHorizontal: 5, borderRadius: radii.pill, backgroundColor: "#E2E8F0" },
  countPillActive: { backgroundColor: colors.primary },
  countPillWarn: { backgroundColor: "#FECACA" },
  countTxt: { fontSize: 10, fontWeight: "800", color: colors.muted, textAlign: "center" },
  countTxtActive: { color: "#fff" },
  queueCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.surface2,
  },
  queueTitle: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  queueMeta: { fontSize: 11, color: colors.muted2, marginTop: 3, marginBottom: 8 },
  queueActions: { flexDirection: "row", gap: 8 },
  btnApprove: { backgroundColor: "#059669", paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.sm },
  btnApproveTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  btnReject: { backgroundColor: "#FEF2F2", paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.sm, borderWidth: 1, borderColor: "#FECACA" },
  btnRejectTxt: { color: "#B91C1C", fontWeight: "800", fontSize: 12 },
  btnDisabled: { opacity: 0.5 },
  caughtUp: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  caughtUpTxt: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  taskTitle: { fontSize: 13, fontWeight: "700", color: colors.ink2 },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  taskAssignee: { fontSize: 11, color: colors.muted2, fontWeight: "600" },
  campusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  tagPws: { backgroundColor: colors.primarySofter },
  tagAlpha: { backgroundColor: colors.accentSoft },
  campusTagTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
  tagPwsTxt: { color: colors.primary },
  tagAlphaTxt: { color: "#0369A1" },
  taskDue: { fontSize: 11, fontWeight: "700", color: colors.muted2 },
  taskDueOverdue: { color: "#B91C1C" },
  alertRow: { gap: 8, marginBottom: 12 },
  alertCard: {
    width: 140,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "#FFFBEB",
    padding: 10,
  },
  alertCardHot: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  alertPct: { fontSize: 18, fontWeight: "800", color: "#B45309" },
  alertCampus: { fontSize: 12, fontWeight: "700", color: colors.ink2, marginTop: 2 },
  alertSport: { fontSize: 10, color: colors.muted, marginTop: 2 },
  headcountStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#ECFDF5",
  },
  headcountStripTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.ink2 },
  headcountStripNum: { fontWeight: "800", color: "#059669", fontSize: 14 },
  emptyHint: { fontSize: 12, color: colors.hint, paddingVertical: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.35)", justifyContent: "flex-start", alignItems: "flex-end", padding: 24, paddingTop: 80 },
  quickMenu: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, minWidth: 220, padding: 8, ...shadow.md },
  quickMenuTitle: { fontSize: 11, fontWeight: "800", color: colors.hint, textTransform: "uppercase", paddingHorizontal: 10, paddingVertical: 8 },
  quickMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radii.sm },
  quickMenuTxt: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
});

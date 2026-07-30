import { useState, useCallback, useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, useAuth } from "./auth";
import { LoadingState, ErrorState, getApiError } from "./ScreenStates";
import { formatDate } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import { fetchDashboardMvp } from "./dashboardApi";
import { colors, radii, shadow, spacing } from "./theme";

type AssignedClass = {
  section_id: string;
  section_label?: string;
  grade_name?: string;
  subject_id: string;
  subject_name?: string;
};

type SectionAttendance = {
  section_id: string;
  section_label?: string;
  total_students: number;
  marked_today: number;
  present_today: number;
};

type TeacherTask = {
  id: string;
  title: string;
  priority?: string;
  due_date?: string;
  status?: string;
};

type TeacherDashboardData = {
  today?: string;
  assigned_classes?: AssignedClass[];
  attendance_today?: SectionAttendance[];
  pending_marks_entry?: number;
  recent_notifications?: Array<{ id: string; title: string; message?: string; read?: boolean }>;
  unread_notifications?: number;
};

const OPEN_TASK_STATUSES = new Set(["open", "assigned", "in_progress", "blocked", "delayed"]);

const ZONE = {
  academic: { bg: "#EFF6FF", border: "#BFDBFE", accent: "#2563EB" },
  attendance: { bg: "#F0FDF4", border: "#BBF7D0", accent: "#16A34A" },
  workflow: { bg: "#FFFBEB", border: "#FDE68A", accent: "#D97706" },
  alerts: { bg: "#FAF5FF", border: "#E9D5FF", accent: "#9333EA" },
} as const;

type ZoneKey = keyof typeof ZONE;

function pct(marked: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((marked / total) * 100));
}

function formatDueLabel(due?: string) {
  if (!due) return "—";
  const iso = due.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return "Today";
  return formatDate(iso);
}

function priorityStyle(priority?: string) {
  const p = (priority || "low").toLowerCase();
  if (p === "high" || p === "urgent") return { bg: colors.dangerSoft, fg: "#B91C1C", label: "High" };
  if (p === "medium" || p === "med") return { bg: colors.warningSoft, fg: "#B45309", label: "Med" };
  return { bg: colors.borderSoft, fg: colors.muted, label: "Low" };
}

function attendanceBadge(marked: number, total: number) {
  if (total === 0) return { label: "No students", bg: colors.borderSoft, fg: colors.muted };
  if (marked === 0) return { label: "Pending", bg: colors.warningSoft, fg: "#B45309" };
  if (marked >= total) return { label: "Complete", bg: colors.successSoft, fg: "#047857" };
  return { label: "In progress", bg: colors.infoSoft, fg: colors.primary };
}

function ZoneCard({ zone, style, children }: { zone: ZoneKey; style?: object; children: ReactNode }) {
  const z = ZONE[zone];
  return (
    <View style={[s.zoneCard, { backgroundColor: z.bg, borderColor: z.border, borderLeftColor: z.accent }, style]}>
      {children}
    </View>
  );
}

function CardHead({
  icon,
  title,
  action,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  action?: ReactNode;
}) {
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

function StatCard({
  label,
  value,
  hint,
  icon,
  tint,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: keyof typeof Feather.glyphMap;
  tint: string;
  onPress?: () => void;
}) {
  const inner = (
    <View style={[s.statCard, { borderLeftColor: tint }]}>
      <View style={[s.statIconWrap, { backgroundColor: `${tint}18` }]}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.statValue}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
        {hint ? <Text style={s.statHint}>{hint}</Text> : null}
      </View>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={s.statCardWrap} onPress={onPress} activeOpacity={0.85}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={s.statCardWrap}>{inner}</View>;
}

export default function TeacherHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth, isWide, height } = useBreakpoint();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [openTasks, setOpenTasks] = useState<TeacherTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [mvp, tasksRes] = await Promise.all([
        fetchDashboardMvp(),
        api.get("/tasks", { params: { mine: true } }).catch(() => ({ data: [] })),
      ]);
      setData(mvp as TeacherDashboardData);
      const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      setOpenTasks(
        tasks
          .filter((t: TeacherTask) => OPEN_TASK_STATUSES.has(t.status || "open"))
          .slice(0, 5),
      );
    } catch (e: unknown) {
      setError(getApiError(e));
      setData(null);
      setOpenTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const classes = data?.assigned_classes || [];
  const att = data?.attendance_today || [];
  const notifs = data?.recent_notifications || [];

  const attendanceTotals = useMemo(() => {
    const marked = att.reduce((n, row) => n + (row.marked_today || 0), 0);
    const total = att.reduce((n, row) => n + (row.total_students || 0), 0);
    const present = att.reduce((n, row) => n + (row.present_today || 0), 0);
    return { marked, total, present };
  }, [att]);

  const pendingMarks = data?.pending_marks_entry ?? 0;

  if (!user) return null;

  const quickActions = [
    { label: "Mark attendance", icon: "user-check" as const, href: "/(tabs)/attendance", tint: "#16A34A" },
    { label: "Enter marks", icon: "edit-3" as const, href: "/academic/marks", tint: colors.primary },
    { label: "Task tracker", icon: "check-square" as const, href: "/(tabs)/tasks", tint: "#D97706" },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]} testID="teacher-dashboard">
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
        {loading && !refreshing ? (
          <LoadingState message="Loading dashboard…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* Header */}
            <View style={[s.header, isWide && s.headerWide]}>
              <View style={{ flex: 1 }}>
                <Text style={s.overline}>Dashboard · {formatDate(data?.today)}</Text>
                <Text style={[s.h1, isWide && s.h1Wide]}>Hello, {user.name.split(" ")[0]}</Text>
                <Text style={s.sub}>
                  Teacher · {classes.length} class assignment{classes.length === 1 ? "" : "s"}
                </Text>
              </View>
              <View style={s.headerActions}>
                <View style={s.scopeBadge}>
                  <Text style={s.scopeBadgeTxt}>PWS</Text>
                </View>
                <TouchableOpacity testID="teacher-notif" style={s.bellBtn} onPress={() => router.push("/notifications")}>
                  <Feather name="bell" size={18} color={colors.ink2} />
                  {(data?.unread_notifications ?? 0) > 0 && <View style={s.bellDot} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* KPI row */}
            <View style={[s.kpiRow, isWide && s.kpiRowWide]}>
              <StatCard
                label="Assigned classes"
                value={String(classes.length)}
                hint={classes.length === 1 ? "1 class" : `${classes.length} classes`}
                icon="book-open"
                tint={colors.primary}
              />
              <StatCard
                label="Pending marks"
                value={String(pendingMarks)}
                hint={pendingMarks === 0 ? "All caught up" : "Assessments need entry"}
                icon="edit-3"
                tint="#D97706"
                onPress={() => router.push("/academic/marks")}
              />
              <StatCard
                label="Today's attendance"
                value={`${attendanceTotals.marked} / ${attendanceTotals.total}`}
                hint={`${attendanceTotals.present} present`}
                icon="user-check"
                tint="#16A34A"
                onPress={() => router.push("/(tabs)/attendance")}
              />
            </View>

            {/* Main grid */}
            <View style={[s.grid, isWide && s.gridWide]}>
              {/* Primary column */}
              <View style={[s.mainCol, isWide && s.mainColWide]}>
                <ZoneCard zone="academic">
                  <CardHead
                    icon="book-open"
                    title={`Assigned classes (${classes.length})`}
                    action={
                      classes.length > 0 ? (
                        <TouchableOpacity onPress={() => router.push("/academic/marks")}>
                          <Text style={s.link}>Gradebooks</Text>
                        </TouchableOpacity>
                      ) : undefined
                    }
                  />
                  {classes.length === 0 ? (
                    <Text style={s.emptyHint}>
                      No classes assigned yet. Your class assignments will appear here once configured by admin.
                    </Text>
                  ) : (
                    <View style={s.classGrid}>
                      {classes.map((c) => {
                        const label = c.section_label || c.grade_name || "Class";
                        const attRow = att.find((a) => a.section_id === c.section_id);
                        const badge = attendanceBadge(attRow?.marked_today ?? 0, attRow?.total_students ?? 0);
                        return (
                          <Pressable
                            key={`${c.section_id}-${c.subject_id}`}
                            style={({ pressed }) => [s.classCard, pressed && s.classCardPressed]}
                            onPress={() => router.push("/academic/marks")}
                          >
                            <View style={s.classCardTop}>
                              <Text style={s.classTitle}>{label}</Text>
                              <View style={[s.badge, { backgroundColor: badge.bg }]}>
                                <Text style={[s.badgeTxt, { color: badge.fg }]}>{badge.label}</Text>
                              </View>
                            </View>
                            <Text style={s.classSub}>{c.subject_name || "Subject"}</Text>
                            <View style={s.classLinks}>
                              <TouchableOpacity
                                style={s.classLinkBtn}
                                onPress={() => router.push("/(tabs)/attendance")}
                              >
                                <Feather name="user-check" size={12} color={colors.primary} />
                                <Text style={s.classLinkTxt}>Attendance</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={s.classLinkBtn}
                                onPress={() => router.push("/academic/marks")}
                              >
                                <Feather name="edit-3" size={12} color={colors.primary} />
                                <Text style={s.classLinkTxt}>Marks</Text>
                              </TouchableOpacity>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </ZoneCard>

                <ZoneCard zone="attendance" style={s.attendanceCard}>
                  <CardHead
                    icon="check-square"
                    title="Today's attendance"
                    action={
                      <TouchableOpacity style={s.markAttBtn} onPress={() => router.push("/(tabs)/attendance")}>
                        <Feather name="plus" size={12} color="#fff" />
                        <Text style={s.markAttBtnTxt}>Mark attendance</Text>
                      </TouchableOpacity>
                    }
                  />
                  {att.length === 0 ? (
                    <Text style={s.emptyHint}>
                      Attendance for your sections will show here after marking.
                    </Text>
                  ) : (
                    <View style={s.attList}>
                      {att.map((a) => {
                        const progress = pct(a.marked_today, a.total_students);
                        const badge = attendanceBadge(a.marked_today, a.total_students);
                        const barColor = a.marked_today === 0 ? "#F59E0B" : a.marked_today >= a.total_students ? "#16A34A" : colors.primary;
                        return (
                          <View
                            key={a.section_id}
                            style={[s.attRow, a.marked_today === 0 && a.total_students > 0 && s.attRowWarn]}
                          >
                            <View style={s.attRowMain}>
                              <View style={s.attRowLeft}>
                                <Text style={s.attLabel}>{a.section_label || "Section"}</Text>
                                <View style={[s.badge, { backgroundColor: badge.bg }]}>
                                  <Text style={[s.badgeTxt, { color: badge.fg }]}>{badge.label}</Text>
                                </View>
                              </View>
                              <Text style={s.attRatio}>
                                {a.marked_today}/{a.total_students}
                              </Text>
                            </View>
                            <View style={s.progressTrack}>
                              <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: barColor }]} />
                            </View>
                            <Text style={s.attMeta}>
                              {a.marked_today} marked · {a.present_today} present
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ZoneCard>
              </View>

              {/* Sidebar column */}
              <View style={[s.sideCol, isWide && s.sideColWide]}>
                <View style={s.surfaceCard}>
                  <CardHead icon="zap" title="Quick actions" />
                  <View style={s.actionGrid}>
                    {quickActions.map((a) => (
                      <TouchableOpacity
                        key={a.href}
                        style={s.actionCard}
                        onPress={() => router.push(a.href as any)}
                        activeOpacity={0.85}
                      >
                        <View style={[s.actionIcon, { backgroundColor: `${a.tint}18` }]}>
                          <Feather name={a.icon} size={18} color={a.tint} />
                        </View>
                        <Text style={s.actionLabel}>{a.label}</Text>
                        <Feather name="chevron-right" size={14} color={colors.hint} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <ZoneCard zone="workflow">
                  <CardHead
                    icon="list"
                    title={`My tasks (${openTasks.length})`}
                    action={
                      openTasks.length > 0 ? (
                        <TouchableOpacity onPress={() => router.push("/(tabs)/tasks")}>
                          <Text style={s.link}>View all</Text>
                        </TouchableOpacity>
                      ) : undefined
                    }
                  />
                  {openTasks.length === 0 ? (
                    <View style={s.caughtUpRow}>
                      <Feather name="check-circle" size={16} color={colors.success} />
                      <Text style={s.caughtUpTxt}>No open tasks — you're caught up</Text>
                    </View>
                  ) : (
                    openTasks.map((task, idx) => {
                      const pri = priorityStyle(task.priority);
                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={[s.taskRow, idx > 0 && s.taskRowBorder]}
                          onPress={() => router.push("/(tabs)/tasks")}
                        >
                          <Text style={s.taskTitle} numberOfLines={1}>{task.title}</Text>
                          <View style={s.taskMeta}>
                            <View style={[s.priorityPill, { backgroundColor: pri.bg }]}>
                              <Text style={[s.priorityTxt, { color: pri.fg }]}>{pri.label}</Text>
                            </View>
                            <Text style={s.taskDue}>{formatDueLabel(task.due_date)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                  {pendingMarks > 0 && (
                    <TouchableOpacity style={s.alertBanner} onPress={() => router.push("/academic/marks")}>
                      <Feather name="alert-circle" size={14} color="#B45309" />
                      <Text style={s.alertBannerTxt}>
                        {pendingMarks} assessment{pendingMarks === 1 ? "" : "s"} need marks entry
                      </Text>
                      <Feather name="arrow-right" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </ZoneCard>

                <ZoneCard zone="alerts">
                  <CardHead
                    icon="bell"
                    title="Recent notifications"
                    action={
                      notifs.length > 0 ? (
                        <TouchableOpacity onPress={() => router.push("/notifications")}>
                          <Text style={s.link}>View all</Text>
                        </TouchableOpacity>
                      ) : undefined
                    }
                  />
                  {notifs.length === 0 ? (
                    <Text style={s.emptyHint}>No recent notifications.</Text>
                  ) : (
                    notifs.map((n) => (
                      <TouchableOpacity
                        key={n.id}
                        style={s.notifRow}
                        onPress={() => router.push("/notifications")}
                      >
                        <View style={[s.notifDot, !n.read && s.notifDotUnread]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.notifTitle} numberOfLines={1}>{n.title}</Text>
                          {n.message ? (
                            <Text style={s.notifMsg} numberOfLines={2}>{n.message}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ZoneCard>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollViewport: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  scrollWide: { paddingVertical: 10, paddingBottom: 12, flexGrow: 1 },
  header: { marginBottom: spacing.md, gap: spacing.sm },
  headerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  overline: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.hint,
    textTransform: "uppercase",
  },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 2 },
  h1Wide: { fontSize: 20, marginTop: 0 },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  scopeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  scopeBadgeTxt: { fontSize: 11, fontWeight: "800", color: colors.primary, letterSpacing: 0.5 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  bellDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  kpiRow: { gap: spacing.sm, marginBottom: spacing.md },
  kpiRowWide: { flexDirection: "row" },
  statCardWrap: { flex: 1 },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: spacing.md,
    ...shadow.sm,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 11, fontWeight: "700", color: colors.muted2, marginTop: 1 },
  statHint: { fontSize: 10, color: colors.hint, marginTop: 2 },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, flex: 1 },
  mainCol: { gap: spacing.md },
  mainColWide: { flex: 2, minWidth: 0 },
  sideCol: { gap: spacing.md },
  sideColWide: { flex: 1, minWidth: 280, maxWidth: 380 },
  zoneCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
    padding: spacing.md,
    ...shadow.sm,
  },
  surfaceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  attendanceCard: { marginTop: 0 },
  cardHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: colors.muted2,
    textTransform: "uppercase",
  },
  link: { fontSize: 11, fontWeight: "700", color: colors.primary },
  emptyHint: { fontSize: 12, color: colors.hint, lineHeight: 18, paddingVertical: 4 },
  classGrid: { gap: spacing.sm },
  classCard: {
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,0.8)",
    padding: spacing.md,
  },
  classCardPressed: { opacity: 0.92 },
  classCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  classTitle: { fontSize: 14, fontWeight: "700", color: colors.ink, flex: 1 },
  classSub: { fontSize: 12, color: colors.muted2, marginTop: 4 },
  classLinks: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  classLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySofter,
  },
  classLinkTxt: { fontSize: 11, fontWeight: "600", color: colors.primary },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
  markAttBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#16A34A",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  markAttBtnTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  attList: { gap: spacing.sm },
  attRow: {
    borderWidth: 1,
    borderColor: "rgba(187,247,208,0.8)",
    borderRadius: radii.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  attRowWarn: { borderColor: "#FDE68A", backgroundColor: "#FFFBEB" },
  attRowMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  attRowLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  attLabel: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  attRatio: { fontSize: 12, fontWeight: "700", color: colors.muted2 },
  progressTrack: {
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(148,163,184,0.3)",
    overflow: "hidden",
  },
  progressFill: { height: 5, borderRadius: 99 },
  attMeta: { fontSize: 10, color: colors.muted2 },
  actionGrid: { gap: spacing.sm },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink2 },
  caughtUpRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  caughtUpTxt: { fontSize: 12, fontWeight: "600", color: colors.ink2, flex: 1 },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 8,
  },
  taskRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  taskTitle: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.ink2 },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  priorityPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  priorityTxt: { fontSize: 9, fontWeight: "800" },
  taskDue: { fontSize: 10, color: colors.hint },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#FDE68A",
    backgroundColor: "rgba(255,255,255,0.65)",
  },
  alertBannerTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.ink2 },
  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(233,213,255,0.5)",
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginTop: 5,
  },
  notifDotUnread: { backgroundColor: colors.primary },
  notifTitle: { fontSize: 12, fontWeight: "700", color: colors.ink2 },
  notifMsg: { fontSize: 11, color: colors.muted2, marginTop: 2, lineHeight: 16 },
});

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, PRIORITY_COLORS } from "../../src/auth";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../../src/ScreenStates";
import { formatDate } from "../../src/dateFormat";
import { useBreakpoint } from "../../src/useBreakpoint";
import { colors, radii, spacing } from "../../src/theme";

const FILTERS: { key: "all" | "mine" | "high" | "pending"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My tasks" },
  { key: "high", label: "High priority" },
  { key: "pending", label: "Pending" },
];

function statusBadgeStyle(status: string) {
  if (status === "completed") {
    return { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0" };
  }
  return { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" };
}

function formatStatusLabel(status: string) {
  return status.replace("_", " ").toUpperCase();
}

export default function Tasks() {
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [filter, setFilter] = useState<"all" | "mine" | "high" | "pending">("all");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const pageStyle = {
    paddingHorizontal: horizontalPadding,
    maxWidth: contentMaxWidth,
    alignSelf: contentMaxWidth ? ("center" as const) : undefined,
    width: contentMaxWidth ? ("100%" as const) : undefined,
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const params: any = {};
      if (filter === "mine") params.mine = true;
      if (filter === "high") params.priority = "high";
      if (filter === "pending") params.status = "open";
      const { data } = await api.get("/tasks", { params });
      setTasks(data);
    } catch (e: any) {
      setError(getApiError(e, "Could not load tasks."));
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const toggleComplete = async (task: any) => {
    if (togglingId) return;
    const nextStatus = task.status === "completed" ? "open" : "completed";
    setTogglingId(task.id);
    try {
      await api.patch(`/tasks/${task.id}`, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not update task.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[s.page, pageStyle]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.h1}>Tasks</Text>
            <Text style={s.sub}>{tasks.length} task{tasks.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity testID="new-task" onPress={() => router.push("/task/new")} style={s.newBtn}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={s.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        <View style={s.filterTrack} testID="task-filter-track">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[s.filterItem, active && s.filterItemActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.filterText, active && s.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && !refreshing ? (
          <LoadingState message="Loading tasks…" compact />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No tasks"
            message="No tasks match this filter. Create one or try a different filter."
            actionLabel="New task"
            onAction={() => router.push("/task/new")}
          />
        ) : (
          <View style={s.list}>
            {tasks.map((t) => {
              const completed = t.status === "completed";
              const assignee = t.assignee_name || t.created_by_name || "Unassigned";
              const badge = statusBadgeStyle(t.status);
              const priColor = PRIORITY_COLORS[t.priority] || colors.muted;

              return (
                <Pressable
                  key={t.id}
                  testID={`task-${t.id}`}
                  style={({ hovered }: any) => [s.card, hovered && s.cardHover]}
                >
                  <TouchableOpacity
                    testID={`task-check-${t.id}`}
                    style={[s.checkbox, completed && s.checkboxDone]}
                    disabled={togglingId === t.id}
                    onPress={() => toggleComplete(t)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: completed }}
                  >
                    {completed ? (
                      <Feather name="check" size={14} color="#fff" />
                    ) : null}
                  </TouchableOpacity>

                  <Pressable
                    style={({ hovered }: any) => [s.cardBody, hovered && s.cardBodyHover]}
                    onPress={() => router.push(`/task/${t.id}`)}
                  >
                    <Text style={[s.title, completed && s.titleDone]} numberOfLines={2}>{t.title}</Text>
                    {t.description ? (
                      <Text style={s.desc} numberOfLines={2}>{t.description}</Text>
                    ) : null}

                    <View style={s.metaRow}>
                      <View style={s.metaItem}>
                        <Feather name="user" size={13} color={colors.muted2} />
                        <Text style={s.meta} numberOfLines={1}>{assignee}</Text>
                      </View>
                      {t.due_date ? (
                        <View style={s.metaItem}>
                          <Feather name="calendar" size={13} color={colors.muted2} />
                          <Text style={s.meta}>{formatDate(t.due_date)}</Text>
                        </View>
                      ) : null}
                      <View style={[s.priPill, { backgroundColor: priColor + "18" }]}>
                        <View style={[s.priDot, { backgroundColor: priColor }]} />
                        <Text style={[s.priText, { color: priColor }]}>{t.priority.toUpperCase()}</Text>
                      </View>
                      {t.comments?.length > 0 && (
                        <View style={s.metaItem}>
                          <Feather name="message-circle" size={13} color={colors.muted2} />
                          <Text style={s.meta}>{t.comments.length}</Text>
                        </View>
                      )}
                    </View>
                  </Pressable>

                  <View style={[s.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[s.statusText, { color: badge.text }]}>
                      {formatStatusLabel(t.status)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.pageBg },
  page: {
    paddingTop: spacing.lg,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  h1: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E40AF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  newBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  filterTrack: {
    flexDirection: "row",
    backgroundColor: colors.surface2,
    borderRadius: radii.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    flexWrap: "wrap",
  },
  filterItem: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 88,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    alignItems: "center",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  filterItemActive: {
    backgroundColor: "#0F172A",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
  },
  filterTextActive: {
    color: "#fff",
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: { transition: "box-shadow 0.15s ease, border-color 0.15s ease" } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      },
    }),
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    borderRadius: radii.sm,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  cardBodyHover: Platform.select({
    web: { opacity: 0.92 } as object,
    default: {},
  }),
  cardHover: Platform.select({
    web: {
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
      borderColor: "#CBD5E1",
    } as object,
    default: {},
  }),
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  checkboxDone: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 22,
  },
  titleDone: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  desc: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  priPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  priDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
});

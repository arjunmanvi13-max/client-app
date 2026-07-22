import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../auth";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../../ScreenStates";
import { useBreakpoint } from "../../useBreakpoint";
import { colors, radii, spacing } from "../../theme";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskCard } from "./TaskCard";
import { TaskTable } from "./TaskTable";
import {
  matchesTaskSearch,
  matchesTaskStatusFilter,
  isTaskOpen,
  type TaskRecord,
  type TaskStatusFilter,
  type TaskViewTab,
} from "./taskTypes";

const VIEW_TABS: { key: TaskViewTab; label: string }[] = [
  { key: "assigned_to_me", label: "Assigned to Me" },
  { key: "assigned_by_me", label: "Tasks I Assigned" },
];

const STATUS_FILTERS: { key: TaskStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "high", label: "High Priority" },
  { key: "overdue", label: "Overdue" },
];

const EMPTY_TASKS_BY_TAB: Record<TaskViewTab, TaskRecord[]> = {
  assigned_to_me: [],
  assigned_by_me: [],
};

function scopeTasksForTab(rows: TaskRecord[], tab: TaskViewTab, uid?: string): TaskRecord[] {
  if (!uid) return rows;
  return rows.filter((task) =>
    tab === "assigned_to_me"
      ? task.assignee_id === uid || (task.assignee_ids || []).includes(uid)
      : task.created_by === uid,
  );
}

export default function TaskTracker() {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding, contentMaxWidth, isWide } = useBreakpoint();

  const [viewTab, setViewTab] = useState<TaskViewTab>("assigned_to_me");
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tasksByTab, setTasksByTab] = useState<Record<TaskViewTab, TaskRecord[]>>(EMPTY_TASKS_BY_TAB);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);

  const pageStyle = {
    paddingHorizontal: horizontalPadding,
    maxWidth: contentMaxWidth,
    alignSelf: contentMaxWidth ? ("center" as const) : undefined,
    width: contentMaxWidth ? ("100%" as const) : undefined,
  };

  const load = useCallback(async () => {
    setError("");
    try {
      const uid = user?.id;
      const [assignedRes, createdRes] = await Promise.all([
        api.get("/tasks", { params: { assigned_to_me: true } }),
        api.get("/tasks", { params: { created_by_me: true } }),
      ]);
      const assignedRows = Array.isArray(assignedRes.data) ? assignedRes.data : [];
      const createdRows = Array.isArray(createdRes.data) ? createdRes.data : [];
      setTasksByTab({
        assigned_to_me: scopeTasksForTab(assignedRows, "assigned_to_me", uid),
        assigned_by_me: scopeTasksForTab(createdRows, "assigned_by_me", uid),
      });
    } catch (e: any) {
      setError(getApiError(e, "Could not load tasks."));
      setTasksByTab(EMPTY_TASKS_BY_TAB);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const tasks = tasksByTab[viewTab];

  const openCounts = useMemo(
    () => ({
      assigned_to_me: tasksByTab.assigned_to_me.filter((task) => isTaskOpen(task.status)).length,
      assigned_by_me: tasksByTab.assigned_by_me.filter((task) => isTaskOpen(task.status)).length,
    }),
    [tasksByTab],
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!matchesTaskStatusFilter(task, statusFilter)) return false;
      return matchesTaskSearch(task, searchQuery);
    });
  }, [tasks, statusFilter, searchQuery]);

  const patchTask = async (task: TaskRecord, patch: Record<string, unknown>) => {
    setBusyId(task.id);
    try {
      const { data } = await api.patch(`/tasks/${task.id}`, patch);
      setTasksByTab((prev) => {
        const merge = (list: TaskRecord[]) =>
          list.map((t) => (t.id === task.id ? { ...t, ...data } : t));
        return {
          assigned_to_me: merge(prev.assigned_to_me),
          assigned_by_me: merge(prev.assigned_by_me),
        };
      });
      return data;
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not update task.");
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (task: TaskRecord, status: string) => {
    if (task.status === status) return;
    await patchTask(task, { status });
  };

  const handleComplete = async (task: TaskRecord) => {
    await patchTask(task, { status: "completed" });
  };

  const handleNudge = async (task: TaskRecord) => {
    setBusyId(task.id);
    try {
      const { data } = await api.post(`/tasks/${task.id}/nudge`);
      Alert.alert("Reminder sent", `Notified ${data.nudged} assignee(s).`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not send reminder.");
    } finally {
      setBusyId(null);
    }
  };

  const openCreateModal = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEditModal = (task: TaskRecord) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTask(null);
  };

  const canCreateTasks = viewTab === "assigned_by_me" || Boolean(user?.id);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[s.page, pageStyle]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.h1}>Task Tracker</Text>
            <Text style={s.sub}>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
              {viewTab === "assigned_to_me" ? " assigned to you" : " you delegated"}
            </Text>
          </View>
          <TouchableOpacity testID="new-task" onPress={openCreateModal} style={s.newBtn}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={s.newBtnText}>New Task</Text>
          </TouchableOpacity>
        </View>

        <View style={s.viewTabTrack} testID="task-view-tabs">
          {VIEW_TABS.map((tab) => {
            const active = viewTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                testID={`view-tab-${tab.key}`}
                onPress={() => setViewTab(tab.key)}
                style={[s.viewTab, active && s.viewTabActive]}
              >
                <View style={s.viewTabLabelRow}>
                  <Text style={[s.viewTabText, active && s.viewTabTextActive]}>{tab.label}</Text>
                  <Text
                    testID={`view-tab-open-count-${tab.key}`}
                    style={s.viewTabOpenCount}
                  >
                    ({openCounts[tab.key]})
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.searchWrap}>
          <Feather name="search" size={16} color={colors.hint} />
          <TextInput
            testID="task-search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search tasks, assignor, or assignee…"
            placeholderTextColor={colors.hint}
            style={s.searchInput}
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Feather name="x" size={16} color={colors.hint} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={s.filterTrack} testID="task-filter-track">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setStatusFilter(f.key)}
                style={[s.filterItem, active && s.filterItemActive]}
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
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No tasks"
            message={
              viewTab === "assigned_to_me"
                ? "No tasks are assigned to you for this filter."
                : "You have not delegated any tasks matching this filter."
            }
            actionLabel={canCreateTasks ? "New task" : undefined}
            onAction={canCreateTasks ? openCreateModal : undefined}
          />
        ) : isWide ? (
          <TaskTable
            tasks={filteredTasks}
            viewTab={viewTab}
            busyId={busyId}
            onOpen={(task) => router.push(`/task/${task.id}`)}
            onStatusChange={handleStatusChange}
            onNudge={handleNudge}
            onEdit={openEditModal}
            onComplete={handleComplete}
          />
        ) : (
          <View style={s.list}>
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                viewTab={viewTab}
                busy={busyId === task.id}
                onOpen={(t) => router.push(`/task/${t.id}`)}
                onStatusChange={handleStatusChange}
                onNudge={handleNudge}
                onEdit={openEditModal}
                onComplete={handleComplete}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CreateTaskModal
        visible={modalOpen}
        task={editingTask}
        onClose={closeModal}
        onSaved={load}
      />
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
  viewTabTrack: {
    flexDirection: "row",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 2,
  },
  viewTab: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  viewTabActive: { borderBottomColor: "#1E40AF" },
  viewTabLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewTabText: { fontSize: 14, fontWeight: "700", color: colors.muted },
  viewTabTextActive: { color: "#1E40AF" },
  viewTabOpenCount: { fontSize: 14, fontWeight: "800", color: "#16A34A" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
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
  filterItemActive: { backgroundColor: "#0F172A" },
  filterText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  filterTextActive: { color: "#fff" },
  list: { gap: spacing.sm },
});

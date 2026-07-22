import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { PRIORITY_COLORS, ROLE_COLORS, roleLabel } from "../../auth";
import { formatDateTime } from "../../dateFormat";
import { colors, radii, spacing } from "../../theme";
import {
  ASSIGNED_TO_ME_STATUSES,
  formatTaskStatus,
  isTaskOverdue,
  statusBadgeStyle,
  taskCategory,
  taskDueDate,
  type TaskRecord,
  type TaskViewTab,
} from "./taskTypes";

type TaskTableProps = {
  tasks: TaskRecord[];
  viewTab: TaskViewTab;
  busyId?: string | null;
  onOpen: (task: TaskRecord) => void;
  onStatusChange: (task: TaskRecord, status: string) => void;
  onNudge?: (task: TaskRecord) => void;
  onEdit?: (task: TaskRecord) => void;
  onComplete?: (task: TaskRecord) => void;
};

function RoleBadge({ role }: { role?: string }) {
  if (!role) return null;
  const color = ROLE_COLORS[role] || colors.muted;
  return (
    <View style={[s.roleBadge, { backgroundColor: color + "18", borderColor: color + "44" }]}>
      <Text style={[s.roleBadgeText, { color }]}>{roleLabel(role)}</Text>
    </View>
  );
}

export function TaskTable({
  tasks,
  viewTab,
  busyId,
  onOpen,
  onStatusChange,
  onNudge,
  onEdit,
  onComplete,
}: TaskTableProps) {
  return (
    <View style={s.table}>
      <View style={s.headerRow}>
        <Text style={[s.headerCell, s.colTitle]}>Task</Text>
        <Text style={[s.headerCell, s.colPerson]}>
          {viewTab === "assigned_to_me" ? "Assigned by" : "Assigned to"}
        </Text>
        <Text style={[s.headerCell, s.colPriority]}>Priority</Text>
        <Text style={[s.headerCell, s.colDeadline]}>Deadline</Text>
        <Text style={[s.headerCell, s.colStatus]}>Status</Text>
        <Text style={[s.headerCell, s.colActions]}>{viewTab === "assigned_by_me" ? "Actions" : ""}</Text>
      </View>

      {tasks.map((task) => {
        const category = taskCategory(task);
        const due = taskDueDate(task);
        const overdue = isTaskOverdue(task);
        const badge = statusBadgeStyle(task.status);
        const priColor = PRIORITY_COLORS[task.priority] || colors.muted;
        const busy = busyId === task.id;

        return (
          <Pressable
            key={task.id}
            testID={`task-row-${task.id}`}
            style={({ hovered }: any) => [s.row, hovered && s.rowHover]}
            onPress={() => onOpen(task)}
          >
            <View style={[s.cell, s.colTitle]}>
              <Text style={s.rowTitle} numberOfLines={2}>{task.title}</Text>
              {category ? (
                <View style={s.categoryBadge}>
                  <Text style={s.categoryText}>{category}</Text>
                </View>
              ) : null}
            </View>

            <View style={[s.cell, s.colPerson]}>
              <Text style={s.personName} numberOfLines={1}>
                {viewTab === "assigned_to_me" ? task.created_by_name : task.assignee_name}
              </Text>
              <RoleBadge role={viewTab === "assigned_to_me" ? task.created_by_role : task.assignee_role} />
            </View>

            <View style={[s.cell, s.colPriority]}>
              <View style={[s.priPill, { backgroundColor: priColor + "18" }]}>
                <View style={[s.priDot, { backgroundColor: priColor }]} />
                <Text style={[s.priText, { color: priColor }]}>{task.priority.toUpperCase()}</Text>
              </View>
            </View>

            <View style={[s.cell, s.colDeadline]}>
              <Text style={[s.deadlineText, overdue && s.overdueText]}>
                {due ? formatDateTime(due) : "—"}
              </Text>
            </View>

            <View style={[s.cell, s.colStatus]}>
              {viewTab === "assigned_to_me" ? (
                <View style={s.statusToggleRow}>
                  {ASSIGNED_TO_ME_STATUSES.map((status) => {
                    const active = task.status === status || (status === "open" && task.status === "assigned");
                    return (
                      <TouchableOpacity
                        key={status}
                        testID={`task-status-${task.id}-${status}`}
                        disabled={busy}
                        style={[s.statusChip, active && s.statusChipActive]}
                        onPress={() => onStatusChange(task, status)}
                      >
                        <Text style={[s.statusChipText, active && s.statusChipTextActive]}>
                          {formatTaskStatus(status)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={[s.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                  <Text style={[s.statusText, { color: badge.text }]}>{formatTaskStatus(task.status)}</Text>
                </View>
              )}
            </View>

            <View style={[s.cell, s.colActions]}>
              {viewTab === "assigned_by_me" ? (
                <View style={s.actionRow}>
                  <TouchableOpacity
                    testID={`task-nudge-${task.id}`}
                    style={s.iconBtn}
                    disabled={busy}
                    onPress={() => onNudge?.(task)}
                  >
                    <Feather name="bell" size={16} color="#1E40AF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`task-edit-${task.id}`}
                    style={s.iconBtn}
                    disabled={busy}
                    onPress={() => onEdit?.(task)}
                  >
                    <Feather name="edit-2" size={16} color="#475569" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`task-complete-${task.id}`}
                    style={[s.iconBtn, s.iconBtnPrimary]}
                    disabled={busy || task.status === "completed"}
                    onPress={() => onComplete?.(task)}
                  >
                    <Feather name="check-circle" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  table: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerCell: { fontSize: 11, fontWeight: "800", color: colors.muted2, letterSpacing: 0.4, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    gap: spacing.sm,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  rowHover: Platform.select({ web: { backgroundColor: "#F8FAFC" } as object, default: {} }),
  cell: { justifyContent: "center", minWidth: 0 },
  colTitle: { flex: 2.2 },
  colPerson: { flex: 1.4 },
  colPriority: { flex: 0.9 },
  colDeadline: { flex: 1.2 },
  colStatus: { flex: 1.6 },
  colActions: { flex: 0.9, alignItems: "flex-end" },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  categoryBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#EEF2FF",
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 10, fontWeight: "800", color: "#4338CA" },
  personName: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  roleBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: { fontSize: 10, fontWeight: "800" },
  priPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    alignSelf: "flex-start",
  },
  priDot: { width: 6, height: 6, borderRadius: 3 },
  priText: { fontSize: 10, fontWeight: "800" },
  deadlineText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  overdueText: { color: colors.danger, fontWeight: "800" },
  statusToggleRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  statusChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  statusChipText: { fontSize: 9, fontWeight: "800", color: colors.muted },
  statusChipTextActive: { color: "#fff" },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: "800" },
  actionRow: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnPrimary: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
});

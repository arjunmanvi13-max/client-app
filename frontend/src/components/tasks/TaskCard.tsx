import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { PRIORITY_COLORS, ROLE_COLORS, roleLabel } from "../../auth";
import { formatDate, formatDateTime } from "../../dateFormat";
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

type TaskCardProps = {
  task: TaskRecord;
  viewTab: TaskViewTab;
  busy?: boolean;
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

function PriorityTag({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] || colors.muted;
  return (
    <View style={[s.priPill, { backgroundColor: color + "18" }]}>
      <View style={[s.priDot, { backgroundColor: color }]} />
      <Text style={[s.priText, { color: color }]}>{priority.toUpperCase()}</Text>
    </View>
  );
}

export function TaskCard({
  task,
  viewTab,
  busy,
  onOpen,
  onStatusChange,
  onNudge,
  onEdit,
  onComplete,
}: TaskCardProps) {
  const category = taskCategory(task);
  const due = taskDueDate(task);
  const overdue = isTaskOverdue(task);
  const badge = statusBadgeStyle(task.status);

  return (
    <Pressable
      testID={`task-${task.id}`}
      style={({ hovered }: any) => [s.card, hovered && s.cardHover]}
      onPress={() => onOpen(task)}
    >
      <View style={s.cardMain}>
        <View style={s.titleRow}>
          <Text style={s.title} numberOfLines={2}>{task.title}</Text>
          {category ? (
            <View style={s.categoryBadge}>
              <Text style={s.categoryText}>{category}</Text>
            </View>
          ) : null}
        </View>
        {task.description ? (
          <Text style={s.desc} numberOfLines={2}>{task.description}</Text>
        ) : null}

        <View style={s.metaRow}>
          {viewTab === "assigned_to_me" ? (
            <View style={s.personBlock}>
              <Feather name="user" size={13} color={colors.muted2} />
              <Text style={s.metaLabel}>Assigned by</Text>
              <Text style={s.metaValue} numberOfLines={1}>{task.created_by_name || "—"}</Text>
              <RoleBadge role={task.created_by_role} />
            </View>
          ) : (
            <View style={s.personBlock}>
              <Feather name="user-check" size={13} color={colors.muted2} />
              <Text style={s.metaLabel}>Assigned to</Text>
              <Text style={s.metaValue} numberOfLines={1}>{task.assignee_name || "—"}</Text>
              <RoleBadge role={task.assignee_role} />
            </View>
          )}
          {due ? (
            <View style={s.metaItem}>
              <Feather name="calendar" size={13} color={overdue ? colors.danger : colors.muted2} />
              <Text style={[s.metaValue, overdue && s.overdueText]}>
                {formatDateTime(due)}
              </Text>
            </View>
          ) : null}
          <PriorityTag priority={task.priority} />
        </View>

        {viewTab === "assigned_to_me" ? (
          <View style={s.statusRow}>
            {ASSIGNED_TO_ME_STATUSES.map((status) => {
              const active = task.status === status || (status === "open" && task.status === "assigned");
              return (
                <TouchableOpacity
                  key={status}
                  testID={`task-status-${task.id}-${status}`}
                  disabled={busy}
                  style={[s.statusChip, active && s.statusChipActive]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onStatusChange(task, status);
                  }}
                >
                  <Text style={[s.statusChipText, active && s.statusChipTextActive]}>
                    {formatTaskStatus(status)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={s.actionRow}>
            <TouchableOpacity
              testID={`task-nudge-${task.id}`}
              style={s.actionBtn}
              disabled={busy}
              onPress={(e) => {
                e.stopPropagation?.();
                onNudge?.(task);
              }}
            >
              <Feather name="bell" size={14} color="#1E40AF" />
              <Text style={s.actionBtnText}>Remind</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`task-edit-${task.id}`}
              style={s.actionBtn}
              disabled={busy}
              onPress={(e) => {
                e.stopPropagation?.();
                onEdit?.(task);
              }}
            >
              <Feather name="edit-2" size={14} color="#475569" />
              <Text style={s.actionBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID={`task-complete-${task.id}`}
              style={[s.actionBtn, s.actionBtnPrimary]}
              disabled={busy || task.status === "completed"}
              onPress={(e) => {
                e.stopPropagation?.();
                onComplete?.(task);
              }}
            >
              <Feather name="check-circle" size={14} color="#fff" />
              <Text style={[s.actionBtnText, s.actionBtnTextPrimary]}>Complete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[s.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
        <Text style={[s.statusText, { color: badge.text }]}>{formatTaskStatus(task.status)}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
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
      web: { cursor: "pointer", transition: "box-shadow 0.15s ease, border-color 0.15s ease" } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      },
    }),
  },
  cardHover: Platform.select({
    web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)", borderColor: "#CBD5E1" } as object,
    default: {},
  }),
  cardMain: { flex: 1, minWidth: 0, gap: 8 },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  categoryBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: { fontSize: 10, fontWeight: "800", color: "#4338CA", letterSpacing: 0.3 },
  desc: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  personBlock: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, maxWidth: "100%" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaLabel: { fontSize: 11, color: colors.muted2, fontWeight: "600" },
  metaValue: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  overdueText: { color: colors.danger, fontWeight: "800" },
  roleBadge: {
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
  },
  priDot: { width: 6, height: 6, borderRadius: 3 },
  priText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  statusChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  statusChipText: { fontSize: 10, fontWeight: "800", color: colors.muted },
  statusChipTextActive: { color: "#fff" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  actionBtnPrimary: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  actionBtnText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  actionBtnTextPrimary: { color: "#fff" },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
});

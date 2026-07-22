import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { api, PRIORITY_COLORS, useAuth } from "../../auth";
import { FormLabel, InlineFieldError, getApiError } from "../../ScreenStates";
import {
  ASSIGNEE_ROLE_FILTERS,
  filterAssigneeUsers,
  filterAssignableUsersForCreator,
  type AssigneeRoleFilter,
  type AssigneeUser,
} from "../../taskAssigneeFilters";
import { filterActiveUsers } from "../../userStatus";
import { useBreakpoint } from "../../useBreakpoint";
import { DATE_PLACEHOLDER, formatDate, parseToISO } from "../../dateFormat";
import { colors, radii, spacing } from "../../theme";
import { TASK_CATEGORIES, taskDueDate, type TaskRecord } from "./taskTypes";

const PRIORITIES = ["low", "medium", "high"] as const;
const ENTITIES = ["pws", "alpha", "both"] as const;
const NON_ASSIGNABLE_ROLES = ["student", "player", "parent"];

type CreateTaskModalProps = {
  visible: boolean;
  task?: TaskRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

function defaultDueParts(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(17, 0, 0, 0);
  return {
    date: formatDate(d.toISOString()),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

function duePartsFromTask(task?: TaskRecord | null): { date: string; time: string } {
  const due = taskDueDate(task || ({} as TaskRecord));
  if (!due) return defaultDueParts();
  const dt = new Date(due);
  if (isNaN(dt.getTime())) return defaultDueParts();
  return {
    date: formatDate(due),
    time: `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`,
  };
}

function buildDueIso(dateStr: string, timeStr: string): string | null {
  const isoDate = parseToISO(dateStr);
  if (!isoDate) return null;
  const [hh = "17", mm = "00"] = timeStr.split(":");
  return `${isoDate}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00`;
}

export function CreateTaskModal({ visible, task, onClose, onSaved }: CreateTaskModalProps) {
  const { user } = useAuth();
  const { isWide } = useBreakpoint();
  const isEditing = Boolean(task?.id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [entityId, setEntityId] = useState<"pws" | "alpha" | "both">("pws");
  const [category, setCategory] = useState<string>("General");
  const [dueDate, setDueDate] = useState(defaultDueParts().date);
  const [dueTime, setDueTime] = useState(defaultDueParts().time);
  const [proofUrl, setProofUrl] = useState("");
  const [users, setUsers] = useState<AssigneeUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AssigneeRoleFilter>("all");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titleErr, setTitleErr] = useState("");
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    if (!visible) return;
    const parts = duePartsFromTask(task);
    setTitle(task?.title || "");
    setDescription(task?.description || "");
    setPriority((task?.priority as typeof priority) || "medium");
    setEntityId((task?.entity_id as typeof entityId) || "pws");
    setCategory(task?.category || task?.department || "General");
    setDueDate(parts.date);
    setDueTime(parts.time);
    setProofUrl(task?.proof_url || "");
    setSelected(
      task?.assignee_ids?.length
        ? task.assignee_ids
        : task?.assignee_id
          ? [task.assignee_id]
          : [],
    );
    setAssigneeSearch("");
    setRoleFilter("all");
    setTitleErr("");
    setFormErr("");
  }, [visible, task]);

  useEffect(() => {
    if (!visible) return;
    setLoadingUsers(true);
    (async () => {
      try {
        const { data } = await api.get("/users/directory");
        const active = filterActiveUsers(
          data.filter((u: AssigneeUser) => !NON_ASSIGNABLE_ROLES.includes(u.role || "")),
        );
        setUsers(filterAssignableUsersForCreator(user, active));
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [visible, user]);

  const filteredUsers = useMemo(
    () => filterAssigneeUsers(users, assigneeSearch, roleFilter),
    [users, assigneeSearch, roleFilter],
  );

  const toggleAssignee = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    setFormErr("");
    if (!title.trim()) {
      setTitleErr("Title is required.");
      return;
    }
    if (!selected.length) {
      setFormErr("Select at least one assignee.");
      return;
    }
    const dueIso = buildDueIso(dueDate, dueTime);
    if (!dueIso) {
      setFormErr("Enter a valid due date (DD/MM/YYYY).");
      return;
    }
    setTitleErr("");
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description,
        priority,
        entity_id: entityId,
        category,
        department: category,
        assignee_ids: selected,
        assignee_id: selected[0],
        due_date: dueIso,
        proof_url: proofUrl.trim() || undefined,
      };
      if (isEditing && task?.id) {
        await api.patch(`/tasks/${task.id}`, payload);
      } else {
        await api.post("/tasks", payload);
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setFormErr(getApiError(e, isEditing ? "Failed to update task." : "Failed to create task."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close modal" />
        <View style={[s.panel, isWide && s.panelWide]}>
          <View style={s.header}>
            <Text style={s.headerTitle}>{isEditing ? "Edit task" : "New task"}</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn} testID="close-create-task">
              <Feather name="x" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <FormLabel required>Title</FormLabel>
            <TextInput
              testID="task-title"
              value={title}
              onChangeText={(t) => { setTitle(t); if (titleErr) setTitleErr(""); }}
              placeholder="e.g. Canteen hygiene audit"
              placeholderTextColor={colors.hint}
              style={[s.input, titleErr && s.inputErr]}
            />
            <InlineFieldError message={titleErr} />

            <FormLabel>Description</FormLabel>
            <TextInput
              testID="task-desc"
              value={description}
              onChangeText={setDescription}
              placeholder="Details, context, links…"
              placeholderTextColor={colors.hint}
              multiline
              numberOfLines={4}
              style={[s.input, s.textArea]}
            />

            <FormLabel required>Category</FormLabel>
            <View style={s.chipRow}>
              {TASK_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  testID={`category-${cat}`}
                  style={[s.chip, category === cat && s.chipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[s.chipText, category === cat && s.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormLabel>Entity</FormLabel>
            <View style={s.chipRow}>
              {ENTITIES.map((e) => (
                <TouchableOpacity
                  key={e}
                  testID={`entity-${e}`}
                  style={[s.chip, entityId === e && s.chipDark]}
                  onPress={() => setEntityId(e)}
                >
                  <Text style={[s.chipText, entityId === e && s.chipTextActive]}>{e.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormLabel>Priority</FormLabel>
            <View style={s.chipRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  testID={`pri-${p}`}
                  style={[
                    s.chip,
                    priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] },
                  ]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[s.chipText, priority === p && s.chipTextActive]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormLabel required>Due date & time</FormLabel>
            <View style={s.dateRow}>
              <TextInput
                testID="task-due-date"
                value={dueDate}
                onChangeText={setDueDate}
                placeholder={DATE_PLACEHOLDER}
                placeholderTextColor={colors.hint}
                style={[s.input, s.dateInput]}
              />
              <TextInput
                testID="task-due-time"
                value={dueTime}
                onChangeText={setDueTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.hint}
                style={[s.input, s.timeInput]}
              />
            </View>

            <FormLabel>Attachment URL (optional)</FormLabel>
            <TextInput
              testID="task-attachment"
              value={proofUrl}
              onChangeText={setProofUrl}
              placeholder="https://…"
              placeholderTextColor={colors.hint}
              autoCapitalize="none"
              style={s.input}
            />

            <View style={s.assignHeader}>
              <FormLabel required>Assign to</FormLabel>
              <View style={s.selectedBadge}>
                <Text style={s.selectedBadgeTxt}>{selected.length} selected</Text>
              </View>
            </View>

            <View style={s.searchWrap}>
              <Feather name="search" size={16} color={colors.hint} />
              <TextInput
                testID="assignee-search"
                value={assigneeSearch}
                onChangeText={setAssigneeSearch}
                placeholder="Search by name or role…"
                placeholderTextColor={colors.hint}
                style={s.searchInput}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              {ASSIGNEE_ROLE_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  testID={`assignee-filter-${f.key}`}
                  style={[s.filterChip, roleFilter === f.key && s.filterChipActive]}
                  onPress={() => setRoleFilter(f.key)}
                >
                  <Text style={[s.filterChipTxt, roleFilter === f.key && s.filterChipTxtActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loadingUsers ? (
              <ActivityIndicator color="#1E40AF" style={{ marginTop: 12 }} />
            ) : filteredUsers.length === 0 ? (
              <Text style={s.emptyFilter}>No assignable users match your search or role mapping.</Text>
            ) : (
              filteredUsers.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  testID={`assign-${u.id}`}
                  style={[s.userRow, selected.includes(u.id) && s.userRowActive]}
                  onPress={() => toggleAssignee(u.id)}
                >
                  <View style={[s.checkBox, selected.includes(u.id) && s.checkBoxActive]}>
                    {selected.includes(u.id) ? <Feather name="check" size={14} color="#fff" /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.userName}>{u.name}</Text>
                    <Text style={s.userMeta}>
                      {(u.role || "").replace(/_/g, " ")}
                      {u.department ? ` · ${u.department}` : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          <View style={s.footer}>
            {formErr ? <Text style={s.formErr}>{formErr}</Text> : null}
            <TouchableOpacity
              testID="submit-task"
              onPress={submit}
              disabled={saving}
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.saveTxt}>{isEditing ? "Save changes" : "Create task"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  panel: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92%",
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelWide: { maxWidth: 720 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  closeBtn: { padding: 8 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl, gap: 4 },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 8,
  },
  inputErr: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  textArea: { height: 96, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  chipActive: { backgroundColor: "#4338CA", borderColor: "#4338CA" },
  chipDark: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipText: { fontSize: 12, fontWeight: "800", color: colors.muted },
  chipTextActive: { color: "#fff" },
  dateRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  dateInput: { flex: 1.4, marginBottom: 0 },
  timeInput: { flex: 0.8, marginBottom: 0 },
  assignHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  selectedBadge: { backgroundColor: "#DBEAFE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  selectedBadgeTxt: { fontSize: 12, fontWeight: "800", color: "#1E40AF" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  filterRow: { gap: 8, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  filterChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  filterChipTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  filterChipTxtActive: { color: "#fff" },
  emptyFilter: { fontSize: 13, color: colors.hint, textAlign: "center", marginVertical: 12 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  userRowActive: { borderColor: "#1E40AF", backgroundColor: "#DBEAFE" },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  userName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  userMeta: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  formErr: { fontSize: 13, color: colors.danger, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  saveBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: radii.md, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

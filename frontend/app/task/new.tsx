import { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, PRIORITY_COLORS } from "../../src/auth";
import { FormLabel, InlineFieldError, getApiError } from "../../src/ScreenStates";
import {
  ASSIGNEE_ROLE_FILTERS,
  filterAssigneeUsers,
  type AssigneeRoleFilter,
  type AssigneeUser,
} from "../../src/taskAssigneeFilters";

const PRIORITIES = ["low", "medium", "high"] as const;
const ENTITIES = ["pws", "alpha", "both"] as const;

export default function NewTask() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [entityId, setEntityId] = useState<"pws" | "alpha" | "both">("pws");
  const [users, setUsers] = useState<AssigneeUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AssigneeRoleFilter>("all");
  const [saving, setSaving] = useState(false);
  const [titleErr, setTitleErr] = useState("");
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/users/directory");
      setUsers(data.filter((u: AssigneeUser) => !["student", "player"].includes(u.role || "")));
    })();
  }, []);

  const filteredUsers = useMemo(
    () => filterAssigneeUsers(users, assigneeSearch, roleFilter),
    [users, assigneeSearch, roleFilter],
  );

  const submit = async () => {
    setFormErr("");
    if (!title.trim()) {
      setTitleErr("Title is required.");
      return;
    }
    setTitleErr("");
    setSaving(true);
    try {
      const deadline = new Date(); deadline.setDate(deadline.getDate() + 3);
      await api.post("/tasks", {
        title, description, priority, entity_id: entityId,
        assignee_ids: selected, assignee_id: selected[0] || undefined,
        due_date: deadline.toISOString(),
      });
      router.back();
    } catch (e: any) {
      setFormErr(getApiError(e, "Failed to create task."));
    } finally { setSaving(false); }
  };

  const toggle = (id: string) => setSelected((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity testID="cancel-btn" onPress={() => router.back()} style={s.backBtn}>
          <Feather name="x" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>New task</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <FormLabel required>Title</FormLabel>
        <TextInput
          testID="task-title"
          value={title}
          onChangeText={(t) => { setTitle(t); if (titleErr) setTitleErr(""); }}
          placeholder="e.g. Submit weekly report"
          placeholderTextColor="#94A3B8"
          style={[s.input, titleErr && s.inputErr]}
        />
        <InlineFieldError message={titleErr} />

        <FormLabel>Description</FormLabel>
        <TextInput testID="task-desc" value={description} onChangeText={setDescription} placeholder="Details, context, links…" placeholderTextColor="#94A3B8" multiline numberOfLines={4} style={[s.input, { height: 100, textAlignVertical: "top" }]} />

        <Text style={s.label}>Entity</Text>
        <View style={s.priRow}>
          {ENTITIES.map((e) => (
            <TouchableOpacity key={e} testID={`entity-${e}`} style={[s.priChip, entityId === e && { backgroundColor: "#0F172A", borderColor: "#0F172A" }]} onPress={() => setEntityId(e)}>
              <Text style={[s.priChipText, entityId === e && { color: "#fff" }]}>{e.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Priority</Text>
        <View style={s.priRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity key={p} testID={`pri-${p}`} style={[s.priChip, priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]} onPress={() => setPriority(p)}>
              <Text style={[s.priChipText, priority === p && { color: "#fff" }]}>{p.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.assignHeader}>
          <Text style={s.label}>Assign to</Text>
          <View style={s.selectedBadge}>
            <Text style={s.selectedBadgeTxt}>{selected.length} selected</Text>
          </View>
        </View>

        <View style={s.assignFilterBar}>
          <View style={s.searchWrap}>
            <Feather name="search" size={16} color="#94A3B8" />
            <TextInput
              testID="assignee-search"
              value={assigneeSearch}
              onChangeText={setAssigneeSearch}
              placeholder="Search by name or role…"
              placeholderTextColor="#94A3B8"
              style={s.searchInput}
            />
            {assigneeSearch.length > 0 && (
              <TouchableOpacity onPress={() => setAssigneeSearch("")} hitSlop={8} testID="assignee-search-clear">
                <Feather name="x" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
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
        </View>

        {users.length === 0 ? (
          <ActivityIndicator color="#1E40AF" style={{ marginTop: 12 }} />
        ) : filteredUsers.length === 0 ? (
          <Text style={s.emptyFilter}>No users match your search or filter.</Text>
        ) : filteredUsers.map((u) => (
          <TouchableOpacity key={u.id} testID={`assign-${u.id}`} style={[s.userRow, selected.includes(u.id) && s.userRowActive]} onPress={() => toggle(u.id)}>
            <View style={[s.checkBox, selected.includes(u.id) && { backgroundColor: "#1E40AF", borderColor: "#1E40AF" }]}>
              {selected.includes(u.id) && <Feather name="check" size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{u.name}</Text>
              <Text style={s.userMeta}>{(u.role || "").replace(/_/g, " ")} · {u.organization}{u.department ? ` · ${u.department}` : ""}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.bottomBar}>
        {formErr ? <Text style={s.formErr}>{formErr}</Text> : null}
        <TouchableOpacity testID="submit-task" onPress={submit} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Create task</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  scroll: { padding: 20, paddingBottom: 120 },
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 0, marginTop: 16 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0F172A" },
  inputErr: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  formErr: { fontSize: 13, color: "#B91C1C", fontWeight: "600", marginBottom: 8, textAlign: "center" },
  priRow: { flexDirection: "row", gap: 8 },
  priChip: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  priChipText: { fontWeight: "800", fontSize: 12, color: "#475569" },
  assignHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  selectedBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  selectedBadgeTxt: { fontSize: 12, fontWeight: "800", color: "#1E40AF" },
  assignFilterBar: {
    backgroundColor: "#F4F5F7",
    paddingBottom: 10,
    marginBottom: 8,
    gap: 10,
    ...Platform.select({
      web: { position: "sticky", top: 0, zIndex: 5 } as object,
      default: {},
    }),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  filterChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  filterChipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  filterChipTxtActive: { color: "#fff" },
  emptyFilter: { fontSize: 13, color: "#94A3B8", textAlign: "center", marginTop: 12, marginBottom: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  userRowActive: { borderColor: "#1E40AF", backgroundColor: "#DBEAFE" },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  userMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "#F4F5F7", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  saveBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

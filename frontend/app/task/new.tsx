import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, PRIORITY_COLORS } from "../../src/auth";

const PRIORITIES = ["low", "medium", "high"] as const;

export default function NewTask() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/users/directory");
      setUsers(data.filter((u: any) => !["student", "player"].includes(u.role)));
    })();
  }, []);

  const submit = async () => {
    if (!title.trim()) { Alert.alert("Title required"); return; }
    setSaving(true);
    try {
      const deadline = new Date(); deadline.setDate(deadline.getDate() + 3);
      await api.post("/tasks", { title, description, priority, assignee_ids: selected, deadline: deadline.toISOString() });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
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
        <Text style={s.label}>Title</Text>
        <TextInput testID="task-title" value={title} onChangeText={setTitle} placeholder="e.g. Submit weekly report" placeholderTextColor="#94A3B8" style={s.input} />

        <Text style={s.label}>Description</Text>
        <TextInput testID="task-desc" value={description} onChangeText={setDescription} placeholder="Details, context, links…" placeholderTextColor="#94A3B8" multiline numberOfLines={4} style={[s.input, { height: 100, textAlignVertical: "top" }]} />

        <Text style={s.label}>Priority</Text>
        <View style={s.priRow}>
          {PRIORITIES.map((p) => (
            <TouchableOpacity key={p} testID={`pri-${p}`} style={[s.priChip, priority === p && { backgroundColor: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] }]} onPress={() => setPriority(p)}>
              <Text style={[s.priChipText, priority === p && { color: "#fff" }]}>{p.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Assign to ({selected.length} selected)</Text>
        {users.length === 0 ? <ActivityIndicator color="#1E40AF" /> : users.map((u) => (
          <TouchableOpacity key={u.id} testID={`assign-${u.id}`} style={[s.userRow, selected.includes(u.id) && s.userRowActive]} onPress={() => toggle(u.id)}>
            <View style={[s.checkBox, selected.includes(u.id) && { backgroundColor: "#1E40AF", borderColor: "#1E40AF" }]}>
              {selected.includes(u.id) && <Feather name="check" size={14} color="#fff" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{u.name}</Text>
              <Text style={s.userMeta}>{u.role.replace("_", " ")} · {u.organization}{u.department ? ` · ${u.department}` : ""}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.bottomBar}>
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
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0F172A" },
  priRow: { flexDirection: "row", gap: 8 },
  priChip: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  priChipText: { fontWeight: "800", fontSize: 12, color: "#475569" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  userRowActive: { borderColor: "#1E40AF", backgroundColor: "#DBEAFE" },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  userMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "#F4F5F7", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  saveBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

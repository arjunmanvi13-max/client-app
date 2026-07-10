import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, useAuth, PRIORITY_COLORS, STATUS_COLORS } from "../../src/auth";

const STATUSES = ["assigned", "in_progress", "completed", "delayed", "reviewed"] as const;

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/tasks/${id}`);
    setTask(data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (status: string) => {
    try { await api.patch(`/tasks/${id}`, { status }); await load(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
  };

  const post = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try { await api.post(`/tasks/${id}/comments`, { text: comment }); setComment(""); await load(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setPosting(false); }
  };

  if (!task) return <SafeAreaView style={s.safe}><ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Feather name="chevron-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Task</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.tagRow}>
            <View style={[s.priPill, { backgroundColor: PRIORITY_COLORS[task.priority] + "1A" }]}>
              <Text style={[s.priText, { color: PRIORITY_COLORS[task.priority] }]}>{task.priority.toUpperCase()}</Text>
            </View>
            <View style={[s.statusPill, { backgroundColor: STATUS_COLORS[task.status] + "1A" }]}>
              <Text style={[s.statusText, { color: STATUS_COLORS[task.status] }]}>{task.status.replace("_", " ").toUpperCase()}</Text>
            </View>
          </View>
          <Text style={s.title}>{task.title}</Text>
          {task.description ? <Text style={s.desc}>{task.description}</Text> : null}
          <View style={s.metaCard}>
            <MetaRow icon="user" label="Created by" value={task.created_by_name} />
            {task.deadline && <MetaRow icon="calendar" label="Deadline" value={new Date(task.deadline).toLocaleString()} />}
            <MetaRow icon="clock" label="Created" value={new Date(task.created_at).toLocaleString()} />
          </View>

          <Text style={s.section}>Update status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {STATUSES.map((st) => (
              <TouchableOpacity key={st} testID={`status-${st}`} style={[s.statBtn, task.status === st && { backgroundColor: STATUS_COLORS[st], borderColor: STATUS_COLORS[st] }]} onPress={() => updateStatus(st)}>
                <Text style={[s.statBtnText, task.status === st && { color: "#fff" }]}>{st.replace("_", " ")}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.section}>Comments ({task.comments?.length || 0})</Text>
          {(task.comments || []).map((c: any) => (
            <View key={c.id} style={s.commentCard}>
              <View style={s.commentHeader}>
                <Text style={s.commentName}>{c.user_name}</Text>
                <Text style={s.commentMeta}>{c.user_role} · {new Date(c.created_at).toLocaleString()}</Text>
              </View>
              <Text style={s.commentText}>{c.text}</Text>
            </View>
          ))}
          {(task.comments?.length || 0) === 0 && <Text style={s.empty}>No comments yet</Text>}
        </ScrollView>

        <View style={s.commentBar}>
          <TextInput
            testID="comment-input"
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment…"
            placeholderTextColor="#94A3B8"
            style={s.commentInput}
          />
          <TouchableOpacity testID="post-comment" onPress={post} disabled={posting || !comment.trim()} style={[s.postBtn, (posting || !comment.trim()) && { opacity: 0.4 }]}>
            <Feather name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetaRow({ icon, label, value }: any) {
  return (
    <View style={s.metaRow}>
      <Feather name={icon} size={14} color="#94A3B8" />
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  scroll: { padding: 20, paddingBottom: 100 },
  tagRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  priPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  priText: { fontSize: 10, fontWeight: "800" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: "800" },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5, lineHeight: 30 },
  desc: { fontSize: 15, color: "#475569", marginTop: 8, lineHeight: 22 },
  metaCard: { backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginTop: 16 },
  metaRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  metaLabel: { fontSize: 12, color: "#94A3B8", flex: 1 },
  metaValue: { fontSize: 12, color: "#0F172A", fontWeight: "600" },
  section: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 24, marginBottom: 12 },
  statBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  statBtnText: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "capitalize" },
  commentCard: { backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  commentName: { fontWeight: "700", color: "#0F172A", fontSize: 13 },
  commentMeta: { fontSize: 11, color: "#94A3B8" },
  commentText: { color: "#475569", fontSize: 14, lineHeight: 20 },
  empty: { color: "#64748B", textAlign: "center", padding: 16 },
  commentBar: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  commentInput: { flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: "#0F172A" },
  postBtn: { backgroundColor: "#1E40AF", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});

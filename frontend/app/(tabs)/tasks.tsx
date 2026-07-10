import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, PRIORITY_COLORS, STATUS_COLORS } from "../../src/auth";

const FILTERS: { key: "all" | "mine" | "high" | "pending"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My tasks" },
  { key: "high", label: "High priority" },
  { key: "pending", label: "Pending" },
];

export default function Tasks() {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "mine" | "high" | "pending">("all");
  const [tasks, setTasks] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const params: any = {};
    if (filter === "mine") params.mine = true;
    if (filter === "high") params.priority = "high";
    if (filter === "pending") params.status = "assigned";
    const { data } = await api.get("/tasks", { params });
    setTasks(data);
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Tasks</Text>
          <Text style={s.sub}>{tasks.length} task{tasks.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity testID="new-task" onPress={() => router.push("/task/new")} style={s.newBtn}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={s.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            testID={`filter-${f.key}`}
            onPress={() => setFilter(f.key)}
            style={[s.filterChip, filter === f.key && s.filterChipActive]}
          >
            <Text style={[s.filterText, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}>
        {tasks.length === 0 ? (
          <View style={s.empty}>
            <Feather name="inbox" size={36} color="#94A3B8" />
            <Text style={s.emptyText}>No tasks for this filter</Text>
          </View>
        ) : (
          tasks.map((t) => (
            <TouchableOpacity key={t.id} style={s.card} onPress={() => router.push(`/task/${t.id}`)} testID={`task-${t.id}`}>
              <View style={s.cardTop}>
                <View style={[s.priPill, { backgroundColor: PRIORITY_COLORS[t.priority] + "1A" }]}>
                  <View style={[s.priDot, { backgroundColor: PRIORITY_COLORS[t.priority] }]} />
                  <Text style={[s.priText, { color: PRIORITY_COLORS[t.priority] }]}>{t.priority.toUpperCase()}</Text>
                </View>
                <View style={[s.statusPill, { backgroundColor: STATUS_COLORS[t.status] + "1A" }]}>
                  <Text style={[s.statusText, { color: STATUS_COLORS[t.status] }]}>{t.status.replace("_", " ")}</Text>
                </View>
              </View>
              <Text style={s.title} numberOfLines={2}>{t.title}</Text>
              {t.description ? <Text style={s.desc} numberOfLines={2}>{t.description}</Text> : null}
              <View style={s.cardBottom}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="user" size={12} color="#94A3B8" />
                  <Text style={s.meta}>{t.created_by_name}</Text>
                </View>
                {t.deadline && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="calendar" size={12} color="#94A3B8" />
                    <Text style={s.meta}>{new Date(t.deadline).toLocaleDateString()}</Text>
                  </View>
                )}
                {t.comments?.length > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Feather name="message-circle" size={12} color="#94A3B8" />
                    <Text style={s.meta}>{t.comments.length}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16 },
  h1: { fontSize: 28, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1E40AF", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  newBtnText: { color: "#fff", fontWeight: "700" },
  filterRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  list: { padding: 20, paddingTop: 0, paddingBottom: 100 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  priPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priDot: { width: 6, height: 6, borderRadius: 3 },
  priText: { fontSize: 10, fontWeight: "800" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  title: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  desc: { fontSize: 13, color: "#64748B", lineHeight: 18 },
  cardBottom: { flexDirection: "row", gap: 14, marginTop: 12, alignItems: "center" },
  meta: { fontSize: 12, color: "#64748B" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyText: { color: "#64748B", fontSize: 14 },
});

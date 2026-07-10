import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, ROLE_COLORS } from "../src/auth";

export default function Directory() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { (async () => {
    const { data } = await api.get("/users/directory");
    setUsers(data);
  })(); }, []);

  const filtered = filter === "all" ? users : users.filter((u) => u.role === filter);
  const roles = ["all", ...Array.from(new Set(users.map((u) => u.role)))];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Directory</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
        {roles.map((r) => (
          <TouchableOpacity key={r} style={[s.chip, filter === r && s.chipActive]} onPress={() => setFilter(r)}>
            <Text style={[s.chipText, filter === r && { color: "#fff" }]}>{r.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={s.scroll}>
        {filtered.map((u) => (
          <View key={u.id} style={s.row}>
            <View style={[s.avatar, { backgroundColor: ROLE_COLORS[u.role] || "#94A3B8" }]}>
              <Text style={s.avatarTxt}>{u.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{u.name}</Text>
              <Text style={s.meta}>{u.email}</Text>
              <Text style={s.meta}>{u.role.replace("_", " ")} · {u.organization}{u.department ? ` · ${u.department}` : ""}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  chipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "capitalize" },
  scroll: { padding: 20 },
  row: { flexDirection: "row", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  meta: { fontSize: 12, color: "#64748B", marginTop: 2 },
});

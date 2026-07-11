import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../src/auth";

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const { data } = await api.get("/notifications");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    load();
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        {items.length === 0 ? (
          <View style={s.empty}>
            <Feather name="bell-off" size={36} color="#94A3B8" />
            <Text style={s.emptyText}>No notifications</Text>
          </View>
        ) : items.map((n) => (
          <TouchableOpacity key={n.id} style={[s.card, !n.read && s.unread]} onPress={() => markRead(n.id)}>
            <View style={[s.iconBox, { backgroundColor: n.read ? "#F1F5F9" : "#DBEAFE" }]}>
              <Feather name="bell" size={18} color={n.read ? "#94A3B8" : "#1E40AF"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{n.title}</Text>
              <Text style={s.message}>{n.message || n.body}</Text>
              <Text style={s.time}>{new Date(n.created_at || n.at).toLocaleString()}</Text>
            </View>
            {!n.read && <View style={s.dot} />}
          </TouchableOpacity>
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
  scroll: { padding: 20 },
  card: { flexDirection: "row", gap: 12, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8, alignItems: "center" },
  unread: { borderColor: "#1E40AF", backgroundColor: "#EFF6FF" },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  message: { fontSize: 13, color: "#64748B", marginTop: 2 },
  time: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1E40AF" },
  empty: { padding: 60, alignItems: "center", gap: 10 },
  emptyText: { color: "#64748B" },
});

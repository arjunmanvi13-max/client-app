import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../src/auth";

export default function DeptSports() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  useEffect(() => { (async () => { const { data } = await api.get("/departments/sports"); setData(data); })(); }, []);
  if (!data) return <SafeAreaView style={s.safe}><ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <Text style={s.h1}>Sports Academy (ALPHA)</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.row2}>
          <Stat label="Players" value={data.players} icon="activity" tint="#16A34A" />
          <Stat label="Coaches" value={data.coaches_count} icon="award" tint="#EA580C" />
        </View>

        <Text style={s.section}>Players by sport</Text>
        <View style={s.sportRow}>
          {Object.entries(data.by_sport).map(([sport, count]: any) => (
            <View key={sport} style={s.sportPill}>
              <Text style={s.sportName}>{sport}</Text>
              <Text style={s.sportCount}>{count}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>Today's attendance by slot</Text>
        {Object.keys(data.by_slot).length === 0 ? (
          <Text style={s.empty}>No attendance marked yet today.</Text>
        ) : Object.entries(data.by_slot).map(([slot, vals]: any) => (
          <View key={slot} style={s.slotRow}>
            <View style={s.slotLeft}>
              <Feather name={slot === "Morning" ? "sun" : slot === "Evening" ? "moon" : "circle"} size={16} color={slot === "Morning" ? "#F59E0B" : "#7C3AED"} />
              <Text style={s.slotName}>{slot}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pill label="P" value={vals.present} tint="#10B981" />
              <Pill label="A" value={vals.absent} tint="#EF4444" />
            </View>
          </View>
        ))}

        <Text style={s.section}>Coaches</Text>
        {data.coaches.map((c: any) => (
          <View key={c.id} style={s.coachRow}>
            <View style={[s.avatar, { backgroundColor: "#EA580C" }]}><Text style={s.avatarTxt}>{c.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cName}>{c.name}</Text>
              <Text style={s.cMeta}>{c.assigned_sport || c.department || "—"} · {(c.coach_permissions || []).length} perms</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, tint }: any) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: tint + "1A" }]}><Feather name={icon} size={16} color={tint} /></View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}
function Pill({ label, value, tint }: any) {
  return <View style={[s.pill, { backgroundColor: tint + "1A" }]}><Text style={[s.pillText, { color: tint }]}>{label} {value}</Text></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 16, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 20, fontWeight: "700", color: "#0F172A", flex: 1 },
  scroll: { padding: 20 },
  row2: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  section: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 24, marginBottom: 12 },
  sportRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sportPill: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center" },
  sportName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  sportCount: { fontSize: 13, fontWeight: "800", color: "#EA580C" },
  slotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  slotLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  slotName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: "800" },
  empty: { color: "#64748B", textAlign: "center", padding: 16 },
  coachRow: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  cName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  cMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
});

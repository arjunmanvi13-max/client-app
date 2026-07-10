import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../src/auth";

export default function DeptSchool() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  useEffect(() => { (async () => { const { data } = await api.get("/departments/school"); setData(data); })(); }, []);
  if (!data) return <SafeAreaView style={s.safe}><ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <Text style={s.h1}>School (PWS)</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.row2}>
          <Stat label="Students" value={data.students} icon="users" tint="#2563EB" />
          <Stat label="Teachers" value={data.teachers_count} icon="book-open" tint="#1E40AF" />
        </View>

        <Text style={s.section}>Today's class-wise attendance</Text>
        {Object.keys(data.by_class).length === 0 ? (
          <Text style={s.empty}>No attendance marked yet today.</Text>
        ) : Object.entries(data.by_class).map(([cls, vals]: any) => (
          <View key={cls} style={s.classRow}>
            <Text style={s.className}>Class {cls}</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pill label="P" value={vals.present} tint="#10B981" />
              <Pill label="A" value={vals.absent} tint="#EF4444" />
              <Pill label="L" value={vals.late} tint="#F59E0B" />
            </View>
          </View>
        ))}

        <Text style={s.section}>Teachers</Text>
        {data.teachers.map((t: any) => (
          <View key={t.id} style={s.teacherRow}>
            <View style={s.avatar}><Text style={s.avatarTxt}>{t.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.tName}>{t.name}</Text>
              <Text style={s.tMeta}>{t.department || "—"} · {t.email}</Text>
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
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  scroll: { padding: 20 },
  row2: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  section: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 24, marginBottom: 12 },
  classRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  className: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 11, fontWeight: "800" },
  empty: { color: "#64748B", textAlign: "center", padding: 16 },
  teacherRow: { flexDirection: "row", gap: 12, alignItems: "center", padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1E40AF", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  tName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  tMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
});

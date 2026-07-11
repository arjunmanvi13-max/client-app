import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "../src/auth";
import { formatDate, toISODate } from "../src/dateFormat";

const SKILL_TINT: Record<string, string> = { Beginner: "#10B981", Intermediate: "#0EA5E9", Advanced: "#EF4444", Unassigned: "#94A3B8" };

export default function CoachAttendance() {
  const [slot, setSlot] = useState<"Morning" | "Evening">("Morning");
  const [centre, setCentre] = useState<"Balua" | "Harding Park">("Balua");
  const [sport, setSport] = useState<"Cricket" | "Football">("Cricket");
  const [date, setDate] = useState<string>(() => toISODate());
  const [groups, setGroups] = useState<Record<string, Record<string, any[]>>>({});
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/coach/players", { params: { slot, centre, sport } });
      // Centre→Sport→PlayerType: flatten to PlayerType→[players] for current centre/sport
      const cMap = data.groups[centre] || {};
      const sMap = cMap[sport] || {};
      setGroups(sMap);
      setAbsent(new Set());
    } finally { setLoading(false); }
  }, [slot, centre, sport]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAbsent = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post("/coach/attendance", { date, slot, centre, sport, absent_player_ids: Array.from(absent) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Saved", `${data.present} present · ${data.absent} absent`);
      setAbsent(new Set());
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  // For PlayerType-grouped display
  const ptypes = Object.keys(groups);
  const total = Object.values(groups).reduce((sum: number, list: any) => sum + list.length, 0);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.h1}>Mark attendance</Text>
        <Text style={s.sub}>{formatDate(date)}</Text>
      </View>

      <View style={s.slotRow}>
        {(["Balua", "Harding Park"] as const).map((c) => (
          <TouchableOpacity key={c} testID={`centre-${c}`} style={[s.slotChip, centre === c && s.slotActive]} onPress={() => setCentre(c)}>
            <Feather name="map-pin" size={14} color={centre === c ? "#fff" : "#0F172A"} />
            <Text style={[s.slotText, centre === c && { color: "#fff" }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.slotRow, { paddingTop: 0 }]}>
        {(["Cricket", "Football"] as const).map((sp) => (
          <TouchableOpacity key={sp} testID={`sport-${sp}`} style={[s.slotChip, sport === sp && s.slotActive]} onPress={() => setSport(sp)}>
            <Text style={[s.slotText, sport === sp && { color: "#fff" }]}>{sp}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.slotRow, { paddingTop: 0 }]}>
        {(["Morning", "Evening"] as const).map((sl) => (
          <TouchableOpacity key={sl} testID={`slot-${sl}`} style={[s.slotChip, slot === sl && s.slotActive]} onPress={() => setSlot(sl)}>
            <Feather name={sl === "Morning" ? "sun" : "moon"} size={16} color={slot === sl ? "#fff" : "#0F172A"} />
            <Text style={[s.slotText, slot === sl && { color: "#fff" }]}>{sl}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.banner}>
        <Feather name="info" size={14} color="#1E40AF" />
        <Text style={s.bannerText}>All players Present by default. Tap a player to mark Absent.</Text>
      </View>

      <View style={s.summary}>
        <SumBox label="Total" value={total} color="#0F172A" />
        <SumBox label="Present" value={total - absent.size} color="#10B981" />
        <SumBox label="Absent" value={absent.size} color="#EF4444" />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} /> :
         total === 0 ? (
           <View style={s.empty}>
             <Feather name="users" size={36} color="#94A3B8" />
             <Text style={s.emptyText}>No players in {centre} · {sport} · {slot}.</Text>
             <Text style={s.emptyHint}>Add players from your roster or ask Admin to assign.</Text>
           </View>
         ) : ptypes.map((ptype) => (
          <View key={ptype} style={s.skillBlock}>
            <View style={s.skillHeader}>
              <View style={[s.skillDot, { backgroundColor: ptype === "Hostel" ? "#7C3AED" : ptype === "Day Boarding" ? "#0EA5E9" : "#10B981" }]} />
              <Text style={s.skillTitle}>{ptype} Players</Text>
              <Text style={s.skillCount}>{groups[ptype].length}</Text>
            </View>
            {groups[ptype].map((p: any) => {
              const isAbsent = absent.has(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  testID={`player-${p.id}`}
                  style={[s.row, isAbsent && s.rowAbsent]}
                  onPress={() => toggleAbsent(p.id)}
                >
                  <View style={[s.avatar, { backgroundColor: isAbsent ? "#FEE2E2" : "#DCFCE7" }]}>
                    <Text style={[s.avatarTxt, { color: isAbsent ? "#EF4444" : "#16A34A" }]}>
                      {p.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.name, isAbsent && { textDecorationLine: "line-through", color: "#94A3B8" }]}>{p.name}</Text>
                    <Text style={s.meta}>{p.age ? `${p.age}y · ` : ""}{p.locality || p.city || p.sport || ""}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: isAbsent ? "#FEE2E2" : "#DCFCE7" }]}>
                    <Text style={[s.statusText, { color: isAbsent ? "#EF4444" : "#16A34A" }]}>
                      {isAbsent ? "ABSENT" : "PRESENT"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {total > 0 && (
        <View style={s.bottomBar}>
          <TouchableOpacity testID="save-attendance" onPress={submit} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : (
              <Text style={s.saveTxt}>Submit · {total - absent.size} P / {absent.size} A</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function SumBox({ label, value, color }: any) {
  return (
    <View style={[s.sumBox, { borderTopColor: color }]}>
      <Text style={[s.sumValue, { color }]}>{value}</Text>
      <Text style={s.sumLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  h1: { fontSize: 28, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  slotRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  slotChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  slotActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  slotText: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, padding: 10, backgroundColor: "#DBEAFE", borderRadius: 10 },
  bannerText: { color: "#1E40AF", fontSize: 12, flex: 1 },
  summary: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 12 },
  sumBox: { flex: 1, backgroundColor: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", borderTopWidth: 3, alignItems: "center" },
  sumValue: { fontSize: 20, fontWeight: "800" },
  sumLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  scroll: { padding: 20, paddingTop: 12 },
  skillBlock: { marginBottom: 16 },
  skillHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  skillDot: { width: 10, height: 10, borderRadius: 5 },
  skillTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A", flex: 1 },
  skillCount: { fontSize: 12, color: "#64748B", fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 6 },
  rowAbsent: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontWeight: "800", fontSize: 12 },
  name: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  meta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 9, fontWeight: "800" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyText: { color: "#0F172A", fontSize: 15, fontWeight: "700" },
  emptyHint: { color: "#64748B", fontSize: 13, textAlign: "center" },
  bottomBar: { position: "absolute", bottom: 78, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 8 },
  saveBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

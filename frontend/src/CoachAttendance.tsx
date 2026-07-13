import { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { api, useAuth } from "../src/auth";
import { formatDate, toISODate } from "../src/dateFormat";
import { isCoachUser, resolveCoachDataScope, coachSportAssignmentMessage } from "../src/coachAccess";

const SKILL_TINT: Record<string, string> = { Beginner: "#10B981", Intermediate: "#0EA5E9", Advanced: "#EF4444", Unassigned: "#94A3B8" };
const ALL_CENTRES = ["Balua", "Harding Park"] as const;
const ALL_SPORTS = ["Cricket", "Football"] as const;

export default function CoachAttendance() {
  const { user } = useAuth();
  const scope = useMemo(() => resolveCoachDataScope(user), [user]);
  const lockedSport = scope.sportLocked ? (scope.assignedSport as typeof ALL_SPORTS[number]) : null;
  const allowedCentres = scope.assignedCentres.length ? scope.assignedCentres : [...ALL_CENTRES];

  const [slot, setSlot] = useState<"Morning" | "Evening">("Morning");
  const [centre, setCentre] = useState<"Balua" | "Harding Park">(
    (allowedCentres[0] as "Balua" | "Harding Park") || "Balua",
  );
  const [sport, setSport] = useState<"Cricket" | "Football">(
    lockedSport || "Cricket",
  );
  const [date, setDate] = useState<string>(() => toISODate());
  const [groups, setGroups] = useState<Record<string, Record<string, any[]>>>({});
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveSport = lockedSport || sport;
  const effectiveCentre = allowedCentres.includes(centre) ? centre : (allowedCentres[0] as typeof centre);

  const load = useCallback(async () => {
    if (scope.requiresSportAssignment) return;
    setLoading(true);
    try {
      const { data } = await api.get("/coach/players", { params: { slot, centre: effectiveCentre, sport: effectiveSport } });
      const cMap = data.groups[effectiveCentre] || {};
      const sMap = cMap[effectiveSport] || {};
      setGroups(sMap);
      setAbsent(new Set());
    } finally { setLoading(false); }
  }, [slot, effectiveCentre, effectiveSport, scope.requiresSportAssignment]);
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
    if (scope.requiresSportAssignment) return;
    setSaving(true);
    try {
      const { data } = await api.post("/coach/attendance", {
        date, slot, centre: effectiveCentre, sport: effectiveSport, absent_player_ids: Array.from(absent),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Saved", `${data.present} present · ${data.absent} absent`);
      setAbsent(new Set());
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const ptypes = Object.keys(groups);
  const flatGroups = groups;
  const total = Object.values(flatGroups).reduce((sum: number, list: any) => sum + list.length, 0);

  if (isCoachUser(user) && scope.requiresSportAssignment) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.blocked}>
          <Feather name="alert-circle" size={40} color="#DC2626" />
          <Text style={s.blockedTitle}>Sport assignment required</Text>
          <Text style={s.blockedText}>{coachSportAssignmentMessage(scope)}</Text>
          <Text style={s.blockedHint}>Please contact the Sports Admin.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.h1}>Mark attendance</Text>
        <Text style={s.sub}>{formatDate(date)}</Text>
        {lockedSport && (
          <View style={s.scopeBadge}>
            <Feather name="lock" size={12} color="#1E40AF" />
            <Text style={s.scopeBadgeText}>{lockedSport} roster</Text>
          </View>
        )}
      </View>

      {allowedCentres.length > 1 ? (
        <View style={s.slotRow}>
          {ALL_CENTRES.filter((c) => allowedCentres.includes(c)).map((c) => (
            <TouchableOpacity key={c} testID={`centre-${c}`} style={[s.slotChip, effectiveCentre === c && s.slotActive]} onPress={() => setCentre(c)}>
              <Feather name="map-pin" size={14} color={effectiveCentre === c ? "#fff" : "#0F172A"} />
              <Text style={[s.slotText, effectiveCentre === c && { color: "#fff" }]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : allowedCentres.length === 1 ? (
        <Text style={s.fixedLabel}>Centre: {allowedCentres[0]}</Text>
      ) : null}

      {!lockedSport ? (
        <View style={[s.slotRow, { paddingTop: 0 }]}>
          {ALL_SPORTS.map((sp) => (
            <TouchableOpacity key={sp} testID={`sport-${sp}`} style={[s.slotChip, sport === sp && s.slotActive]} onPress={() => setSport(sp)}>
              <Text style={[s.slotText, sport === sp && { color: "#fff" }]}>{sp}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={s.fixedLabel}>Assigned sport: {lockedSport}</Text>
      )}

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
             <Text style={s.emptyText}>No players in {effectiveCentre} · {effectiveSport} · {slot}.</Text>
             <Text style={s.emptyHint}>Add players from your roster or ask Admin to assign.</Text>
           </View>
         ) : ptypes.map((ptype) => (
          <View key={ptype} style={s.skillBlock}>
            <View style={s.skillHeader}>
              <View style={[s.skillDot, { backgroundColor: ptype === "Hostel" ? "#7C3AED" : ptype === "Day Boarding" ? "#0EA5E9" : "#10B981" }]} />
              <Text style={s.skillTitle}>{ptype} Players</Text>
              <Text style={s.skillCount}>{flatGroups[ptype].length}</Text>
            </View>
            {flatGroups[ptype].map((p: any) => {
              const isAbsent = absent.has(p.id);
              return (
                <TouchableOpacity key={p.id} testID={`player-${p.id}`} style={[s.playerRow, isAbsent && s.playerAbsent]} onPress={() => toggleAbsent(p.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.playerName, isAbsent && { color: "#DC2626" }]}>{p.name}</Text>
                    <Text style={s.playerMeta}>{p.skill_level || "—"} · {p.player_type || "—"}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: isAbsent ? "#FEE2E2" : "#DCFCE7" }]}>
                    <Text style={{ color: isAbsent ? "#DC2626" : "#16A34A", fontWeight: "700", fontSize: 12 }}>{isAbsent ? "Absent" : "Present"}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity testID="submit-attendance" style={[s.submitBtn, (saving || total === 0) && { opacity: 0.5 }]} disabled={saving || total === 0} onPress={submit}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Save attendance</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function SumBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.sumBox}>
      <Text style={[s.sumVal, { color }]}>{value}</Text>
      <Text style={s.sumLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 14, color: "#64748B", marginTop: 2 },
  scopeBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "flex-start", backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  scopeBadgeText: { color: "#1E40AF", fontWeight: "700", fontSize: 12 },
  fixedLabel: { paddingHorizontal: 20, paddingBottom: 8, color: "#475569", fontWeight: "600", fontSize: 13 },
  slotRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  slotChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  slotActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  slotText: { fontWeight: "700", color: "#0F172A", fontSize: 13 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, padding: 10, backgroundColor: "#EFF6FF", borderRadius: 10 },
  bannerText: { flex: 1, color: "#1E40AF", fontSize: 12 },
  summary: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  sumBox: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  sumVal: { fontSize: 20, fontWeight: "800" },
  sumLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },
  skillBlock: { marginBottom: 16 },
  skillHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  skillDot: { width: 8, height: 8, borderRadius: 4 },
  skillTitle: { fontWeight: "700", color: "#0F172A", flex: 1 },
  skillCount: { color: "#64748B", fontWeight: "600" },
  playerRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: "#E2E8F0" },
  playerAbsent: { borderColor: "#FECACA", backgroundColor: "#FEF2F2" },
  playerName: { fontWeight: "700", color: "#0F172A" },
  playerMeta: { color: "#64748B", fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  empty: { alignItems: "center", marginTop: 40, gap: 8 },
  emptyText: { color: "#475569", fontWeight: "600" },
  emptyHint: { color: "#94A3B8", fontSize: 12 },
  submitBtn: { position: "absolute", bottom: 24, left: 16, right: 16, backgroundColor: "#1E40AF", paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  blocked: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  blockedTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  blockedText: { textAlign: "center", color: "#475569", lineHeight: 20 },
  blockedHint: { color: "#64748B", fontSize: 13 },
});

import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../src/auth";
import { formatDate, toISODate } from "../src/dateFormat";

type Coach = {
  id: string;
  name: string;
  email: string;
  coach_type?: "head" | "assistant" | null;
  assigned_centres?: string[];
  assigned_sports?: string[];
};

export default function CoachAttendance() {
  const { user } = useAuth();
  const router = useRouter();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [date] = useState(toISODate());

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isHeadCoach = user?.role === "coach" && user?.coach_type === "head";
  const isAssistantCoach = user?.role === "coach" && user?.coach_type === "assistant";
  const canMark = isAdmin || isHeadCoach;
  const allowed = canMark || isAssistantCoach;

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/attendance/coaches-list");
      setCoaches(data);
    } catch {} finally { setLoading(false); }
  }, [allowed]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggle = (id: string) => {
    if (!canMark) return;
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!coaches.length) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/attendance/coaches", { date, absent_coach_ids: Array.from(absent) });
      Alert.alert("Saved", `${data.present} present · ${data.absent} absent (${data.count} total)`, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  };

  if (!user) return null;
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Coach Attendance</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>Not allowed</Text></View>
      </SafeAreaView>
    );
  }

  const presentCount = coaches.length - absent.size;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="ca-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>COACH ATTENDANCE · {formatDate(date)}</Text>
          <Text style={s.h1}>{canMark ? "Mark coaches" : "Today's coaches"}</Text>
          {!canMark && <Text style={s.sub}>View-only</Text>}
        </View>
      </View>

      <View style={s.summaryCard}>
        <View style={s.sumBlock}><Text style={[s.sumValue, { color: "#10B981" }]}>{presentCount}</Text><Text style={s.sumLabel}>Present</Text></View>
        <View style={s.sumDivider} />
        <View style={s.sumBlock}><Text style={[s.sumValue, { color: "#EF4444" }]}>{absent.size}</Text><Text style={s.sumLabel}>Absent</Text></View>
        <View style={s.sumDivider} />
        <View style={s.sumBlock}><Text style={s.sumValue}>{coaches.length}</Text><Text style={s.sumLabel}>Total</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <ActivityIndicator color="#EA580C" style={{ marginTop: 32 }} /> :
         coaches.length === 0 ? <Text style={s.emptyTextRow}>No coaches found.</Text> :
         coaches.map((c) => {
           const isAbs = absent.has(c.id);
           return (
             <TouchableOpacity key={c.id} testID={`ca-row-${c.id}`} disabled={!canMark} style={[s.row, isAbs && s.rowAbs]} activeOpacity={canMark ? 0.7 : 1} onPress={() => toggle(c.id)}>
               <View style={[s.avatar, { backgroundColor: isAbs ? "#FEE2E2" : "#DCFCE7" }]}>
                 <Feather name={isAbs ? "x" : "check"} size={18} color={isAbs ? "#EF4444" : "#10B981"} />
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={s.name}>{c.name}</Text>
                 <Text style={s.meta}>{(c.coach_type === "head" ? "Head Coach" : "Assistant Coach")} · {(c.assigned_centres || []).join(", ") || "—"}</Text>
               </View>
               <Text style={[s.statusBadge, { color: isAbs ? "#EF4444" : "#10B981" }]}>{isAbs ? "Absent" : "Present"}</Text>
             </TouchableOpacity>
           );
         })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {canMark && coaches.length > 0 && (
        <View style={s.submitBar}>
          <TouchableOpacity testID="ca-submit" disabled={submitting} style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit}>
            {submitting ? <ActivityIndicator color="#fff" /> : <><Feather name="check-circle" size={18} color="#fff" /><Text style={s.submitTxt}>Submit · {presentCount}P / {absent.size}A</Text></>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  sub: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
  summaryCard: { flexDirection: "row", marginHorizontal: 20, marginTop: 12, padding: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  sumBlock: { flex: 1, alignItems: "center" },
  sumDivider: { width: 1, height: 32, backgroundColor: "#E2E8F0" },
  sumValue: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sumLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  scroll: { padding: 20, paddingTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  rowAbs: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  meta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  statusBadge: { fontSize: 12, fontWeight: "800" },
  submitBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EA580C", paddingVertical: 14, borderRadius: 14 },
  submitTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
  emptyTextRow: { textAlign: "center", color: "#94A3B8", marginTop: 24 },
});

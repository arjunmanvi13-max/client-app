import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../src/auth";
import { formatDate, toISODate } from "../src/dateFormat";

const CENTRES = ["Balua", "Harding Park"] as const;

type Staff = {
  id: string;
  name: string;
  group?: string;  // role/designation
  organization: "PWS" | "ALPHA";
  centre?: "Balua" | "Harding Park" | null;
};

export default function StaffAttendance() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [centre, setCentre] = useState<"Balua" | "Harding Park" | null>(null);
  const [date] = useState(toISODate());

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isHeadCoach = user?.role === "coach" && user?.coach_type === "head";
  const isPrincipalVP = user?.role === "principal" || user?.role === "vice_principal";
  const allowed = isAdmin || isHeadCoach || isPrincipalVP;

  // Head-coach assigned centres restrict the dropdown
  const availableCentres = useMemo<("Balua" | "Harding Park")[]>(() => {
    if (isHeadCoach) {
      const mine = user?.assigned_centres || [];
      return (CENTRES.filter((c) => mine.includes(c)) as any) || [];
    }
    return CENTRES as any;
  }, [user, isHeadCoach]);

  // Initialise default centre for head coach with single centre
  useEffect(() => {
    if (isHeadCoach && !centre && availableCentres.length >= 1) {
      setCentre(availableCentres[0]);
    }
  }, [isHeadCoach, availableCentres, centre]);

  const scopeOrg: "PWS" | "ALPHA" | null = isPrincipalVP ? "PWS" : isHeadCoach ? "ALPHA" : null;
  const scopeLabel = isPrincipalVP ? "PWS Staff" : isHeadCoach ? `ALPHA Staff · ${centre || "—"}` : "Staff";

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    setLoading(true);
    try {
      const params: any = {};
      if (isHeadCoach && centre) params.centre = centre;
      if (isAdmin) { params.organization = "PWS"; } // admin default — they can toggle later if needed
      const { data } = await api.get("/attendance/staff-list", { params });
      setStaff(data);
    } catch (e: any) {
      // 403 etc
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [allowed, isHeadCoach, isAdmin, centre]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const toggle = (id: string) => {
    setAbsent((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!staff.length) return;
    setSubmitting(true);
    try {
      const body: any = { date, absent_staff_ids: Array.from(absent) };
      if (isHeadCoach && centre) body.centre = centre;
      if (isAdmin) body.organization = "PWS";
      const { data } = await api.post("/attendance/staff", body);
      Alert.alert(
        "Attendance saved",
        `${data.present} present · ${data.absent} absent (${data.count} total)`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (!allowed) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
          <Text style={s.h1}>Staff Attendance</Text>
        </View>
        <View style={s.empty}>
          <Feather name="lock" size={40} color="#94A3B8" />
          <Text style={s.emptyTitle}>Not available</Text>
          <Text style={s.emptyText}>
            Staff attendance can be marked by Principal / Vice Principal (PWS) or Head Coach (ALPHA, assigned centre).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const presentCount = staff.length - absent.size;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="sa-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>STAFF ATTENDANCE · {formatDate(date)}</Text>
          <Text style={s.h1}>{scopeLabel}</Text>
        </View>
      </View>

      {isHeadCoach && availableCentres.length > 1 && (
        <View style={s.centreRow}>
          {availableCentres.map((c) => (
            <TouchableOpacity
              key={c}
              testID={`sa-centre-${c}`}
              onPress={() => setCentre(c)}
              style={[s.centreChip, centre === c && s.centreChipActive]}
            >
              <Text style={[s.centreTxt, centre === c && s.centreTxtActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.summaryCard}>
        <View style={s.sumBlock}>
          <Text style={[s.sumValue, { color: "#10B981" }]}>{presentCount}</Text>
          <Text style={s.sumLabel}>Present (default)</Text>
        </View>
        <View style={s.sumDivider} />
        <View style={s.sumBlock}>
          <Text style={[s.sumValue, { color: "#EF4444" }]}>{absent.size}</Text>
          <Text style={s.sumLabel}>Absent</Text>
        </View>
        <View style={s.sumDivider} />
        <View style={s.sumBlock}>
          <Text style={s.sumValue}>{staff.length}</Text>
          <Text style={s.sumLabel}>Total</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {loading ? (
          <ActivityIndicator color="#1E40AF" style={{ marginTop: 32 }} />
        ) : staff.length === 0 ? (
          <View style={s.empty}>
            <Feather name="users" size={36} color="#94A3B8" />
            <Text style={s.emptyTitle}>No staff records</Text>
            <Text style={s.emptyText}>No staff found in your scope.{isHeadCoach ? " Check your assigned centre." : ""}</Text>
          </View>
        ) : staff.map((st) => {
          const isAbs = absent.has(st.id);
          return (
            <TouchableOpacity
              key={st.id}
              testID={`sa-row-${st.id}`}
              style={[s.row, isAbs && s.rowAbs]}
              onPress={() => toggle(st.id)}
              activeOpacity={0.7}
            >
              <View style={[s.avatar, { backgroundColor: isAbs ? "#FEE2E2" : "#DCFCE7" }]}>
                <Feather name={isAbs ? "x" : "check"} size={18} color={isAbs ? "#EF4444" : "#10B981"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{st.name}</Text>
                <Text style={s.meta}>
                  {st.group || "Staff"} · {st.organization}{st.centre ? ` · ${st.centre}` : ""}
                </Text>
              </View>
              <Text style={[s.statusBadge, { color: isAbs ? "#EF4444" : "#10B981" }]}>
                {isAbs ? "Absent" : "Present"}
              </Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 120 }} />
      </ScrollView>

      {staff.length > 0 && (
        <View style={s.submitBar}>
          <TouchableOpacity
            testID="sa-submit"
            style={[s.submitBtn, submitting && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={submit}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={s.submitTxt}>Submit · {presentCount}P / {absent.size}A</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2, letterSpacing: -0.5 },
  centreRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginTop: 4 },
  centreChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  centreChipActive: { borderColor: "#EA580C", backgroundColor: "#FFF7ED" },
  centreTxt: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  centreTxtActive: { color: "#EA580C" },
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
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14 },
  submitTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13, lineHeight: 18, paddingHorizontal: 20 },
});

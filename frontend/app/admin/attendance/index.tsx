import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { formatDate, DATE_PLACEHOLDER, toISODate, parseToISO } from "../../../src/dateFormat";

const KINDS = ["student", "player", "staff", "coach", "teacher", "hostel"];

export default function AttendanceAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  const [startDate, setStartDate] = useState(formatDate(toISODate()));
  const [endDate, setEndDate] = useState(formatDate(toISODate()));
  const [kind, setKind] = useState<string | null>(null);
  const [group, setGroup] = useState("");
  const [sport, setSport] = useState("");
  const [session, setSession] = useState("");
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [correctStatus, setCorrectStatus] = useState<"present" | "absent" | "late" | "leave">("present");
  const [correctReason, setCorrectReason] = useState("");

  const canView = user?.role === "super_admin" || user?.role === "admin" || user?.role === "principal"
    || user?.permissions?.view_attendance || user?.permissions?.access_reports;
  const canCorrect = user?.role === "super_admin" || user?.role === "principal"
    || user?.permissions?.correct_attendance;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const startIso = parseToISO(startDate) || startDate;
      const endIso = parseToISO(endDate) || endDate;
      const params: any = { start_date: startIso, end_date: endIso };
      if (kind) params.kind = kind;
      if (group.trim()) params.group = group.trim();
      if (sport.trim()) params.sport = sport.trim();
      if (session.trim()) params.session = session.trim();
      const [sumRes, listRes, auditRes] = await Promise.all([
        api.get("/attendance/summary", { params }),
        api.get("/attendance", { params }),
        api.get("/attendance/audit", { params: { limit: 30 } }),
      ]);
      setSummary(sumRes.data);
      setRecords(listRes.data.slice(0, 50));
      setAudit(auditRes.data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, kind, group, sport, session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const exportCsv = async () => {
    try {
      const startIso = parseToISO(startDate) || startDate;
      const endIso = parseToISO(endDate) || endDate;
      const params: any = { start_date: startIso, end_date: endIso };
      if (kind) params.kind = kind;
      if (group.trim()) params.group = group.trim();
      if (sport.trim()) params.sport = sport.trim();
      if (session.trim()) params.session = session.trim();
      const res = await api.get("/attendance/export", { params, responseType: "blob" });
      if (typeof window !== "undefined") {
        const href = URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = href;
        a.download = `attendance_${startDate}_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(href);
      } else {
        Alert.alert("Exported", "CSV download is available on web.");
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.response?.data?.detail || e?.message || "Could not export");
    }
  };

  const submitCorrection = async () => {
    if (!correctId || !correctReason.trim()) {
      Alert.alert("Reason required", "Enter an audit reason for the correction.");
      return;
    }
    try {
      await api.post("/attendance/correct", {
        record_id: correctId,
        status: correctStatus,
        reason: correctReason.trim(),
      });
      setCorrectId(null);
      setCorrectReason("");
      load();
      Alert.alert("Corrected", "Attendance updated with audit trail.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Correction failed");
    }
  };

  if (!canView) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Attendance reports require view_attendance or admin access.</Text>
      </SafeAreaView>
    );
  }

  const totals = summary?.totals || {};

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Attendance Reports</Text>
          <Text style={s.sub}>Summaries, corrections, export & audit history</Text>
        </View>
        <TouchableOpacity testID="export-attendance" onPress={exportCsv} style={s.exportBtn}>
          <Feather name="download" size={16} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Filters</Text>
          <View style={s.row}>
            <TextInput value={startDate} onChangeText={setStartDate} placeholder={`Start ${DATE_PLACEHOLDER}`} style={s.input} placeholderTextColor="#94A3B8" />
            <TextInput value={endDate} onChangeText={setEndDate} placeholder={`End ${DATE_PLACEHOLDER}`} style={s.input} placeholderTextColor="#94A3B8" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
            <TouchableOpacity style={[s.chip, !kind && s.chipActive]} onPress={() => setKind(null)}>
              <Text style={[s.chipTxt, !kind && s.chipTxtActive]}>All</Text>
            </TouchableOpacity>
            {KINDS.map((k) => (
              <TouchableOpacity key={k} testID={`filter-kind-${k}`} style={[s.chip, kind === k && s.chipActive]} onPress={() => setKind(k)}>
                <Text style={[s.chipTxt, kind === k && s.chipTxtActive]}>{k}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput value={group} onChangeText={setGroup} placeholder="Class / group filter" style={s.input} placeholderTextColor="#94A3B8" />
          <TextInput value={sport} onChangeText={setSport} placeholder="Sport filter" style={s.input} placeholderTextColor="#94A3B8" />
          <TextInput value={session} onChangeText={setSession} placeholder="Session (morning / evening)" style={s.input} placeholderTextColor="#94A3B8" />
          <TouchableOpacity testID="apply-filters" style={s.btn} onPress={load}>
            <Text style={s.btnTxt}>Apply filters</Text>
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color="#1E40AF" /> : summary && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Summary {formatDate(summary.start_date)} → {formatDate(summary.end_date)}</Text>
            <View style={s.statsRow}>
              <Stat label="Present" value={totals.present || 0} color="#10B981" />
              <Stat label="Absent" value={totals.absent || 0} color="#EF4444" />
              <Stat label="Late" value={totals.late || 0} color="#F59E0B" />
              <Stat label="%" value={`${totals.percentage || 0}%`} color="#1E40AF" />
            </View>
            {Object.entries(summary.by_kind || {}).map(([k, v]: any) => (
              <Text key={k} style={s.metaLine}>
                {k}: P {v.present} · A {v.absent} · L {v.late} · {v.percentage}%
              </Text>
            ))}
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Recent records</Text>
          {records.length === 0 ? <Text style={s.hint}>No records for filters.</Text> : records.map((r) => (
            <View key={r.id} style={s.recRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.recTitle}>{formatDate(r.date)} · {r.kind} · {r.session}</Text>
                <Text style={s.recMeta}>{r.status} · {r.group || r.sport || "—"} · by {r.marked_by_name}</Text>
              </View>
              {canCorrect && (
                <TouchableOpacity testID={`correct-${r.id}`} onPress={() => { setCorrectId(r.id); setCorrectStatus(r.status); }}>
                  <Feather name="edit-2" size={16} color="#1E40AF" />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Audit history</Text>
          {audit.length === 0 ? <Text style={s.hint}>No corrections yet.</Text> : audit.map((a) => (
            <View key={a.id} style={s.auditRow}>
              <Text style={s.recTitle}>{formatDate(a.date)} · {a.kind} · {a.action}</Text>
              <Text style={s.recMeta}>{a.before_status} → {a.after_status} · {a.changed_by_name}</Text>
              {a.reason ? <Text style={s.hint}>Reason: {a.reason}</Text> : null}
            </View>
          ))}
        </View>

        {correctId && canCorrect && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Correct attendance</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {(["present", "absent", "late", "leave"] as const).map((st) => (
                <TouchableOpacity key={st} style={[s.chip, correctStatus === st && s.chipActive]} onPress={() => setCorrectStatus(st)}>
                  <Text style={[s.chipTxt, correctStatus === st && s.chipTxtActive]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput value={correctReason} onChangeText={setCorrectReason} placeholder="Audit reason (required)" style={s.input} placeholderTextColor="#94A3B8" />
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, { backgroundColor: "#F1F5F9", flex: 1 }]} onPress={() => setCorrectId(null)}>
                <Text style={[s.btnTxt, { color: "#0F172A" }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="submit-correction" style={[s.btn, { flex: 1 }]} onPress={submitCorrection}>
                <Text style={s.btnTxt}>Save correction</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={[s.statBox, { backgroundColor: color + "18" }]}>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  backBtn: { padding: 8 },
  exportBtn: { padding: 10, backgroundColor: "#DBEAFE", borderRadius: 10 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  scroll: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 10 },
  row: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC", marginBottom: 8 },
  btn: { backgroundColor: "#1E40AF", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "700" },
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8, backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBox: { padding: 12, borderRadius: 10, minWidth: 72, alignItems: "center" },
  statVal: { fontSize: 18, fontWeight: "800" },
  statLbl: { fontSize: 10, color: "#64748B", marginTop: 2 },
  metaLine: { fontSize: 12, color: "#475569", marginTop: 4 },
  recRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  recTitle: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  recMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  auditRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  hint: { fontSize: 12, color: "#64748B" },
  denied: { padding: 24, textAlign: "center", color: "#64748B" },
});

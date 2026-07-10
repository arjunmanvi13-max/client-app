import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../../src/auth";

const STATUS_TINT: Record<string, { bg: string; fg: string; label: string }> = {
  present: { bg: "#DCFCE7", fg: "#15803D", label: "P" },
  absent: { bg: "#FEE2E2", fg: "#B91C1C", label: "A" },
  late: { bg: "#FEF3C7", fg: "#B45309", label: "L" },
  leave: { bg: "#EDE9FE", fg: "#6D28D9", label: "Lv" },
};

function shortDate(d: string) {
  const dt = new Date(d);
  if (isNaN(dt.valueOf())) return d;
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

export default function WardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ward, setWard] = useState<any | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [fees, setFees] = useState<{ fees: any[]; summary: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, aRes, fRes] = await Promise.all([
        api.get("/parent/wards"),
        api.get(`/parent/attendance/${id}`),
        api.get(`/parent/fees/${id}`).catch(() => ({ data: null })),
      ]);
      const w = (wRes.data || []).find((x: any) => x.id === id);
      setWard(w || null);
      setAttendance(aRes.data.records || []);
      setFees(fRes.data || null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="ward-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        </View>
        <ActivityIndicator color="#0891B2" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!ward) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        </View>
        <Text style={s.notFound}>Ward not found.</Text>
      </SafeAreaView>
    );
  }

  const pct = ward.attendance_30d?.pct;
  const absent = ward.attendance_30d?.absent ?? 0;
  const total = ward.attendance_30d?.total ?? 0;
  const present = ward.attendance_30d?.present ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="ward-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>WARD</Text>
          <Text style={s.h1}>{ward.name}</Text>
          <Text style={s.sub}>{ward.kind === "player" ? `${ward.sport || ""} · ${ward.centre || ""}` : `${ward.group || ""}`} · {ward.organization}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.summaryCard}>
          <View style={s.summaryBlock}>
            <Text style={[s.summaryValue, { color: pct !== null && pct !== undefined ? (pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444") : "#94A3B8" }]}>
              {pct !== null && pct !== undefined ? `${pct}%` : "—"}
            </Text>
            <Text style={s.summaryLabel}>Attendance · 30d</Text>
          </View>
          <View style={s.summaryRow}>
            <View style={s.miniBlock}><Text style={[s.miniValue, { color: "#10B981" }]}>{present}</Text><Text style={s.miniLabel}>Present</Text></View>
            <View style={s.miniBlock}><Text style={[s.miniValue, { color: "#EF4444" }]}>{absent}</Text><Text style={s.miniLabel}>Absent</Text></View>
            <View style={s.miniBlock}><Text style={s.miniValue}>{total}</Text><Text style={s.miniLabel}>Total</Text></View>
          </View>
        </View>

        <Text style={s.section}>Recent attendance</Text>
        {attendance.length === 0 ? (
          <Text style={s.emptyMini}>No attendance recorded in the last 30 days.</Text>
        ) : attendance.slice(0, 30).map((r, i) => {
          const t = STATUS_TINT[r.status] || STATUS_TINT.present;
          return (
            <View key={`${r.date}-${r.kind}-${r.session || ""}-${i}`} testID={`att-row-${r.date}`} style={s.attRow}>
              <View style={[s.attBadge, { backgroundColor: t.bg }]}>
                <Text style={[s.attBadgeTxt, { color: t.fg }]}>{t.label}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.attDate}>{shortDate(r.date)}</Text>
                <Text style={s.attMeta}>
                  {r.kind === "player" ? `${r.slot || r.session || ""} · ${r.sport || ""}${r.centre ? " · " + r.centre : ""}` : r.group || r.kind}
                </Text>
              </View>
              <Text style={[s.attStatus, { color: t.fg }]}>{r.status}</Text>
            </View>
          );
        })}

        {ward.organization === "ALPHA" && fees && (
          <>
            <Text style={s.section}>Fees</Text>
            <View style={s.feeSummary}>
              <View style={s.feeBlock}><Text style={[s.feeValue, { color: "#EF4444" }]}>₹{(fees.summary.total_due || 0).toLocaleString()}</Text><Text style={s.feeLabel}>Outstanding</Text></View>
              <View style={s.feeBlock}><Text style={[s.feeValue, { color: "#10B981" }]}>₹{(fees.summary.total_paid || 0).toLocaleString()}</Text><Text style={s.feeLabel}>Paid</Text></View>
              <View style={s.feeBlock}><Text style={[s.feeValue, { color: fees.summary.overdue_count > 0 ? "#EF4444" : "#0F172A" }]}>{fees.summary.overdue_count}</Text><Text style={s.feeLabel}>Overdue</Text></View>
            </View>
            {(fees.fees || []).slice(0, 12).map((f: any, i: number) => {
              const isPaid = f.status === "paid";
              return (
                <View key={f.id || i} style={s.feeRow}>
                  <View style={[s.feeDot, { backgroundColor: isPaid ? "#10B981" : "#F59E0B" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.feeType}>{f.type}{f.period_month ? ` · ${f.period_month}` : ""}</Text>
                    <Text style={s.feeDue}>Due {f.due_date} · ₹{(f.amount_due || f.amount || 0).toLocaleString()}</Text>
                  </View>
                  <View style={[s.feeStatusPill, { backgroundColor: isPaid ? "#DCFCE7" : "#FEF3C7" }]}>
                    <Text style={[s.feeStatusTxt, { color: isPaid ? "#15803D" : "#B45309" }]}>{f.status}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  scroll: { padding: 20 },
  summaryCard: { padding: 18, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  summaryBlock: { alignItems: "center", marginBottom: 14 },
  summaryValue: { fontSize: 36, fontWeight: "800" },
  summaryLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", marginTop: 2, letterSpacing: 0.5 },
  summaryRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12 },
  miniBlock: { flex: 1, alignItems: "center" },
  miniValue: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  miniLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  section: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginTop: 22, marginBottom: 10, letterSpacing: 0.3, textTransform: "uppercase" },
  attRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 6 },
  attBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  attBadgeTxt: { fontWeight: "800", fontSize: 13 },
  attDate: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  attMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  attStatus: { fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
  emptyMini: { fontSize: 13, color: "#64748B", textAlign: "center", padding: 16 },
  feeSummary: { flexDirection: "row", padding: 16, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10 },
  feeBlock: { flex: 1, alignItems: "center" },
  feeValue: { fontSize: 16, fontWeight: "800" },
  feeLabel: { fontSize: 11, color: "#64748B", marginTop: 2, fontWeight: "600" },
  feeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 6 },
  feeDot: { width: 10, height: 10, borderRadius: 5 },
  feeType: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  feeDue: { fontSize: 11, color: "#64748B", marginTop: 2 },
  feeStatusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  feeStatusTxt: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  notFound: { padding: 30, textAlign: "center", color: "#64748B" },
});

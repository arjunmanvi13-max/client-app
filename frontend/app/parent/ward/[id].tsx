import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../../src/auth";
import { entityLabelsFor, ENTITY_COLORS } from "../../../src/parentPortal";
import { LoadingState, ErrorState, EmptyState, getApiError } from "../../../src/ScreenStates";
import { useBreakpoint } from "../../../src/useBreakpoint";
import { formatDate, formatMonth } from "../../../src/dateFormat";

const API_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

async function downloadReportPdf(cardId: string, filename: string) {
  const token = Platform.OS === "web" && typeof window !== "undefined"
    ? window.localStorage.getItem("pws_alpha_token")
    : null;
  const res = await fetch(`${API_ROOT}/api/report-cards/${cardId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("PDF failed");
  const blob = await res.blob();
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

const STATUS_TINT: Record<string, { bg: string; fg: string; label: string }> = {
  present: { bg: "#DCFCE7", fg: "#15803D", label: "P" },
  absent: { bg: "#FEE2E2", fg: "#B91C1C", label: "A" },
  late: { bg: "#FEF3C7", fg: "#B45309", label: "L" },
  leave: { bg: "#EDE9FE", fg: "#6D28D9", label: "Lv" },
};

export default function WardDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [ward, setWard] = useState<any | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [fees, setFees] = useState<{ fees: any[]; summary: any } | null>(null);
  const [marksData, setMarksData] = useState<{ marks: any[]; report_cards: any[] } | null>(null);
  const [coachAsm, setCoachAsm] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [wRes, pRes, aRes, fRes, mRes, caRes, invRes, payRes, recRes] = await Promise.all([
        api.get("/parent/wards"),
        api.get(`/parent/ward/${id}`).catch(() => ({ data: null })),
        api.get(`/parent/attendance/${id}`),
        api.get(`/parent/fees/${id}`).catch(() => ({ data: null })),
        api.get(`/parent/marks/${id}`).catch(() => ({ data: { marks: [], report_cards: [] } })),
        api.get(`/parent/coach-assessments/${id}`).catch(() => ({ data: { assessments: [] } })),
        api.get(`/parent/invoices/${id}`).catch(() => ({ data: { invoices: [] } })),
        api.get(`/parent/payments/${id}`).catch(() => ({ data: { payments: [] } })),
        api.get(`/parent/receipts/${id}`).catch(() => ({ data: { receipts: [] } })),
      ]);
      const w = (wRes.data || []).find((x: any) => x.id === id) || pRes.data;
      setWard(w || null);
      setProfile(pRes.data || w || null);
      setAttendance(aRes.data.records || []);
      setFees(fRes.data || null);
      setMarksData(mRes.data || { marks: [], report_cards: [] });
      setCoachAsm(caRes.data?.assessments || []);
      setInvoices(invRes.data?.invoices || []);
      setPayments(payRes.data?.payments || []);
      setReceipts(recRes.data?.receipts || []);
    } catch (e: any) {
      setError(getApiError(e, "Could not load ward details."));
      setWard(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="ward-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        </View>
        <LoadingState message="Loading ward profile…" />
      </SafeAreaView>
    );
  }

  if (error || !ward) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        </View>
        {error ? (
          <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} />
        ) : (
          <EmptyState icon="user-x" title="Ward not found" message="This ward may have been unlinked from your account." />
        )}
      </SafeAreaView>
    );
  }

  const pct = ward.attendance_30d?.pct;
  const absent = ward.attendance_30d?.absent ?? 0;
  const total = ward.attendance_30d?.total ?? 0;
  const present = ward.attendance_30d?.present ?? 0;
  const labels = entityLabelsFor(ward);
  const showFees = ward.organization === "PWS" || ward.organization === "ALPHA" || ward.organization === "BOTH" || ward.is_dual_participation;
  const showCoach = coachAsm.length > 0 || labels.some((l) => l.code === "ALPHA");

  const openReceipt = (pdfPath: string) => {
    const url = `${API_ROOT}/api${pdfPath}`;
    if (typeof window !== "undefined") window.open(url, "_blank");
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="ward-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>WARD</Text>
          <Text style={s.h1}>{ward.name}</Text>
          <View style={s.entityRow}>
            {labels.map((lb) => {
              const c = ENTITY_COLORS[lb.code] || { bg: "#F1F5F9", fg: "#475569" };
              return (
                <View key={lb.code} style={[s.entityPill, { backgroundColor: c.bg }]}>
                  <Text style={[s.entityPillTxt, { color: c.fg }]}>{lb.name}</Text>
                </View>
              );
            })}
          </View>
          <Text style={s.sub}>{ward.kind === "player" ? `${ward.sport || ""} · ${ward.centre || ""}` : `${ward.group || ""}`}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {(profile?.admission_number || profile?.roll_number) && (
          <>
            <Text style={s.section}>Profile</Text>
            <View style={s.profileCard}>
              {profile.admission_number ? <Text style={s.profileLine}>Admission: {profile.admission_number}</Text> : null}
              {profile.roll_number ? <Text style={s.profileLine}>Roll: {profile.roll_number}</Text> : null}
              {profile.date_of_admission ? <Text style={s.profileLine}>Admitted: {formatDate(profile.date_of_admission)}</Text> : null}
              {profile.is_resident != null ? <Text style={s.profileLine}>Resident: {profile.is_resident ? "Yes" : "No"}</Text> : null}
            </View>
          </>
        )}

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
                <Text style={s.attDate}>{formatDate(r.date)}</Text>
                <Text style={s.attMeta}>
                  {r.kind === "player" ? `${r.slot || r.session || ""} · ${r.sport || ""}${r.centre ? " · " + r.centre : ""}` : r.group || r.kind}
                </Text>
              </View>
              <Text style={[s.attStatus, { color: t.fg }]}>{r.status}</Text>
            </View>
          );
        })}

        {showFees && fees && (
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
                    <Text style={s.feeType}>{f.fee_type || f.type}{f.period_month ? ` · ${formatMonth(f.period_month)}` : ""}</Text>
                    <Text style={s.feeDue}>Due {formatDate(f.due_date)} · ₹{(f.amount_due || f.amount || 0).toLocaleString()}</Text>
                  </View>
                  <View style={[s.feeStatusPill, { backgroundColor: isPaid ? "#DCFCE7" : "#FEF3C7" }]}>
                    <Text style={[s.feeStatusTxt, { color: isPaid ? "#15803D" : "#B45309" }]}>{f.status}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {ward.kind === "student" && marksData && (marksData.marks?.length > 0 || marksData.report_cards?.length > 0) && (
          <>
            <Text style={s.section}>Academic marks</Text>
            {(marksData.marks || []).map((m: any, i: number) => (
              <View key={m.id || i} style={s.markRow} testID={`mark-row-${m.subject_id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={s.markSubject}>{m.subject_name || m.subject_id}</Text>
                  <Text style={s.markMeta}>{m.exam_term_name || "Exam"}</Text>
                </View>
                <Text style={s.markScore}>{m.marks_obtained ?? "—"}/{m.max_marks || 100}</Text>
                <View style={s.markGradePill}><Text style={s.markGradeTxt}>{m.grade || "—"}</Text></View>
              </View>
            ))}
            {(marksData.report_cards || []).map((rc: any) => (
              <View key={rc.id} style={s.rcRow}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/report-cards/${rc.id}`)}>
                  <Text style={s.markSubject}>{rc.exam_term_name || "Report card"}</Text>
                  <Text style={s.markMeta}>
                    {rc.percentage != null ? `${rc.percentage}% · ${rc.overall_grade || "—"}` : "Published"}
                    {rc.attendance_pct != null ? ` · Attendance ${rc.attendance_pct}%` : ""}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`rc-pdf-${rc.id}`}
                  onPress={async () => {
                    try {
                      await downloadReportPdf(rc.id, `${(rc.person_name || "report").replace(/\s+/g, "_")}_report_card.pdf`);
                    } catch {
                      if (typeof window !== "undefined") window.open(`${API_ROOT}/api/report-cards/${rc.id}/pdf`, "_blank");
                    }
                  }}
                >
                  <Feather name="download" size={18} color="#1E40AF" />
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {invoices.length > 0 && (
          <>
            <Text style={s.section}>Invoices</Text>
            {invoices.map((inv: any) => (
              <View key={inv.id} style={s.markRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.markSubject}>{inv.invoice_number}</Text>
                  <Text style={s.markMeta}>Due {formatDate(inv.due_date)} · {inv.status}</Text>
                </View>
                <Text style={s.markScore}>₹{(inv.outstanding_amount ?? inv.balance_due ?? 0).toLocaleString()}</Text>
              </View>
            ))}
          </>
        )}

        {payments.length > 0 && (
          <>
            <Text style={s.section}>Payments</Text>
            {payments.map((p: any) => (
              <View key={p.id} style={s.markRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.markSubject}>{p.receipt_number || "Payment"}</Text>
                  <Text style={s.markMeta}>{formatDate(p.transaction_date)} · {p.payment_mode}{p.invoice_number ? ` · ${p.invoice_number}` : ""}</Text>
                </View>
                <Text style={s.markScore}>₹{(p.amount || 0).toLocaleString()}</Text>
              </View>
            ))}
          </>
        )}

        {receipts.length > 0 && (
          <>
            <Text style={s.section}>Receipts</Text>
            {receipts.map((r: any) => (
              <TouchableOpacity key={r.id} style={s.rcRow} onPress={() => r.pdf_url && openReceipt(r.pdf_url)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.markSubject}>{r.receipt_number}</Text>
                  <Text style={s.markMeta}>{formatDate(r.transaction_date)} · {r.type === "legacy_fee" ? "Fee receipt" : "Invoice receipt"} · ₹{(r.amount || 0).toLocaleString()}</Text>
                </View>
                <Feather name="download" size={18} color="#1E40AF" />
              </TouchableOpacity>
            ))}
          </>
        )}

        {showCoach && coachAsm.length > 0 && (
          <>
            <Text style={s.section}>Coach assessments · ALPHA</Text>
            {coachAsm.map((a: any, i: number) => (
              <View key={a.id || i} style={s.markRow} testID={`coach-asm-${a.id}`}>
                <View style={{ flex: 1 }}>
                  <Text style={s.markSubject}>
                    {a.assessment_stage_label || a.definition_name || "Assessment"}
                  </Text>
                  <Text style={s.markMeta}>
                    {formatDate(a.date)} · {a.sport} · {a.centre} · {a.session || a.slot}
                  </Text>
                  {a.schema_version >= 2 && (a.technical_skill_master_average != null || a.technical_skill_avg != null || a.overall_score != null) ? (
                    <Text style={s.markMeta}>
                      Technical {(a.technical_skill_master_average ?? a.technical_skill_avg) ?? "—"}/10 · Overall {a.overall_score ?? "—"}/10
                    </Text>
                  ) : a.schema_version === 2 && a.scores ? (
                    <Text style={s.markMeta}>
                      Avg{" "}
                      {(
                        Object.values(a.scores).filter((v: any) => v != null).reduce((s: number, v: any) => s + Number(v), 0)
                        / Math.max(Object.values(a.scores).filter((v: any) => v != null).length, 1)
                      ).toFixed(1)}
                      /10 across 5 parameters
                    </Text>
                  ) : null}
                  {a.coach_remark ? <Text style={s.markMeta}>{a.coach_remark}</Text> : null}
                </View>
                <Text style={s.markScore}>
                  {a.schema_version === 2 && a.scores
                    ? `${Object.values(a.scores).filter((v: any) => v != null).length}/5`
                    : a.rating || (a.score != null ? `${a.score}${a.max_score ? `/${a.max_score}` : ""}` : "—")}
                </Text>
              </View>
            ))}
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
  entityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  entityPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  entityPillTxt: { fontSize: 10, fontWeight: "700" },
  profileCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, marginBottom: 8, gap: 4 },
  profileLine: { fontSize: 13, color: "#334155" },
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
  markRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 6 },
  markSubject: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  markMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  markScore: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  markGradePill: { backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  markGradeTxt: { fontSize: 12, fontWeight: "800", color: "#1E40AF" },
  rcRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 6 },
  notFound: { padding: 30, textAlign: "center", color: "#64748B" },
});

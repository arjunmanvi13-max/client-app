/**
 * PWS student fee collection — yearly roadmap, collect, export & share invoice.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Platform, Linking, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../../src/auth";
import { colors, radii, spacing } from "../../../src/theme";
import { LoadingState, ErrorState, getApiError } from "../../../src/ScreenStates";
import { PWS_ACADEMIC_YEAR } from "../../../src/pwsFeeStructure";

const API_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

async function downloadInvoicePdf(studentId: string, filename: string) {
  const token = Platform.OS === "web" && typeof window !== "undefined"
    ? window.localStorage.getItem("pws_alpha_token")
    : null;
  const res = await fetch(`${API_ROOT}/api/pws-fees/invoice/${studentId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("PDF download failed");
  const blob = await res.blob();
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return url;
  }
  return `${API_ROOT}/api/pws-fees/invoice/${studentId}/pdf`;
}

type RoadmapItem = {
  category: string;
  fee_type: string;
  period_month: string;
  amount: number;
  amount_due: number;
  fee_id: string | null;
  status: string;
};

type RoadmapMonth = {
  period_month: string;
  label: string;
  items: RoadmapItem[];
  month_total: number;
  paid_total: number;
};

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function PwsStudentFees() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"Cash" | "Online">("Cash");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    setLoading(true);
    try {
      const { data: roadmap } = await api.get(`/pws-fees/roadmap/${id}`);
      setData(roadmap);
      setSelected(new Set());
    } catch (e: any) {
      setError(getApiError(e, "Could not load fee roadmap."));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const invoiceFilename = `pws-fees-${(data?.student?.name || "student").replace(/\s+/g, "-").toLowerCase()}.pdf`;

  const exportInvoice = async () => {
    if (!id) return;
    try {
      const url = await downloadInvoicePdf(id, invoiceFilename);
      if (Platform.OS !== "web") Linking.openURL(url);
    } catch {
      Alert.alert("Export failed", "Could not download the invoice PDF.");
    }
  };

  const shareInvoice = async () => {
    const student = data?.student;
    const msg = `PWS Fee Statement — ${student?.name || "Student"} (AY ${PWS_ACADEMIC_YEAR})\nOutstanding: ${inr(data?.summary?.total_outstanding || 0)}`;
    if (Platform.OS === "web") {
      try {
        await downloadInvoicePdf(id!, invoiceFilename);
        await navigator.clipboard.writeText(msg);
        window.alert("Invoice downloaded — share the PDF via WhatsApp or email.");
      } catch {
        window.prompt("Copy message:", msg);
      }
    } else {
      await Share.share({ message: msg, title: "PWS Fee Invoice" });
    }
  };

  const toggleFee = (feeId: string | null, status: string) => {
    if (!feeId || status === "paid" || !data?.can_collect) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(feeId)) next.delete(feeId);
      else next.add(feeId);
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    if (!data) return 0;
    let total = 0;
    for (const m of data.months as RoadmapMonth[]) {
      for (const item of m.items) {
        if (item.fee_id && selected.has(item.fee_id)) total += item.amount_due;
      }
    }
    return total;
  }, [data, selected]);

  const collect = async () => {
    if (selected.size === 0) {
      Alert.alert("Select fees", "Check at least one pending fee to collect.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/pws-fees/collect", {
        fee_ids: Array.from(selected),
        payment_mode: mode,
      });
      Alert.alert("Collected", `₹${selectedTotal.toLocaleString("en-IN")} recorded successfully.`);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Collection failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <LoadingState message="Loading fee roadmap…" />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={s.safe}>
        <ErrorState message={error || "Not found"} onRetry={load} />
      </SafeAreaView>
    );
  }

  const st = data.student;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>PWS FEES · {PWS_ACADEMIC_YEAR}</Text>
          <Text style={s.h1}>{st.name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <SummaryPill icon="book" label="Class" value={st.pws_class} />
            <SummaryPill icon="home" label="Type" value={st.pws_student_type} />
            <SummaryPill
              icon="truck"
              label="Transport"
              value={st.transport_enabled ? (st.transport_distance || "Yes") : "No"}
            />
          </View>
          <View style={s.summaryTotals}>
            <View style={s.totalBlock}>
              <Text style={s.totalLabel}>Outstanding</Text>
              <Text style={[s.totalVal, { color: colors.danger }]}>{inr(data.summary.total_outstanding)}</Text>
            </View>
            <View style={s.totalBlock}>
              <Text style={s.totalLabel}>Paid</Text>
              <Text style={[s.totalVal, { color: "#16A34A" }]}>{inr(data.summary.paid_total)}</Text>
            </View>
          </View>
          <View style={s.actionRow}>
            <TouchableOpacity style={s.actionBtn} onPress={exportInvoice} testID="export-invoice">
              <Feather name="download" size={16} color={colors.primary} />
              <Text style={s.actionTxt}>Export Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.actionBtn} onPress={shareInvoice} testID="share-invoice">
              <Feather name="share-2" size={16} color={colors.primary} />
              <Text style={s.actionTxt}>Share Invoice</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.sectionTitle}>Yearly roadmap</Text>
        {(data.months as RoadmapMonth[]).map((month) => (
          <View key={month.period_month} style={s.monthCard}>
            <View style={s.monthHeader}>
              <Text style={s.monthLabel}>{month.label}</Text>
              <Text style={s.monthMeta}>
                {month.paid_total > 0 && <Text style={{ color: "#16A34A" }}>{inr(month.paid_total)} paid · </Text>}
                {month.month_total > 0 ? `${inr(month.month_total)} due` : "All paid"}
              </Text>
            </View>
            {month.items.map((item) => {
              const paid = item.status === "paid";
              const checked = item.fee_id ? selected.has(item.fee_id) : false;
              return (
                <TouchableOpacity
                  key={`${item.fee_type}-${item.period_month}-${item.category}`}
                  style={[s.feeRow, paid && s.feeRowPaid]}
                  disabled={paid || !data.can_collect}
                  onPress={() => toggleFee(item.fee_id, item.status)}
                >
                  <View style={[s.checkbox, checked && s.checkboxOn, paid && s.checkboxPaid]}>
                    {checked && <Feather name="check" size={12} color="#fff" />}
                    {paid && <Feather name="check" size={12} color="#16A34A" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.feeCat}>{item.category}</Text>
                    <Text style={s.feeType}>{item.fee_type}</Text>
                  </View>
                  <Text style={[s.feeAmt, paid && { color: "#16A34A" }]}>{inr(item.amount_due)}</Text>
                  <Text style={[s.feeStatus, paid && { color: "#16A34A" }]}>{paid ? "Paid" : "Due"}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      {data.can_collect && (
        <View style={s.bottomBar}>
          <View style={s.modeRow}>
            {(["Cash", "Online"] as const).map((m) => (
              <TouchableOpacity key={m} style={[s.modeBtn, mode === m && s.modeBtnActive]} onPress={() => setMode(m)}>
                <Text style={[s.modeTxt, mode === m && s.modeTxtActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.collectBtn, (submitting || selected.size === 0) && { opacity: 0.5 }]}
            disabled={submitting || selected.size === 0}
            onPress={collect}
            testID="collect-pws-fees"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check-circle" size={18} color="#fff" />
                <Text style={s.collectTxt}>Collect {inr(selectedTotal)}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function SummaryPill({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={s.pill}>
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={s.pillLabel}>{label}</Text>
      <Text style={s.pillVal} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 6 },
  overline: { fontSize: 11, fontWeight: "800", color: colors.muted, letterSpacing: 0.6 },
  h1: { fontSize: 20, fontWeight: "800", color: colors.ink },
  scroll: { padding: spacing.md, paddingBottom: 40 },
  summaryCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  pill: { flex: 1, minWidth: 100, backgroundColor: colors.primarySofter, borderRadius: radii.md, padding: 10, gap: 4 },
  pillLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  pillVal: { fontSize: 13, fontWeight: "700", color: colors.ink },
  summaryTotals: { flexDirection: "row", gap: 16, marginBottom: spacing.md },
  totalBlock: { flex: 1 },
  totalLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  totalVal: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  actionTxt: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.muted, letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" },
  monthCard: { backgroundColor: colors.surface, borderRadius: radii.lg, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  monthHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, backgroundColor: colors.borderSoft },
  monthLabel: { fontWeight: "800", color: colors.ink, fontSize: 14 },
  monthMeta: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  feeRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  feeRowPaid: { opacity: 0.85 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxPaid: { borderColor: "#16A34A", backgroundColor: "#DCFCE7" },
  feeCat: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  feeType: { fontSize: 11, color: colors.muted, marginTop: 2 },
  feeAmt: { fontWeight: "800", color: colors.ink, fontSize: 14, marginRight: 8 },
  feeStatus: { fontSize: 11, fontWeight: "700", color: colors.danger, width: 36, textAlign: "right" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, gap: 10 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeTxt: { fontWeight: "700", color: colors.muted, fontSize: 13 },
  modeTxtActive: { color: "#fff" },
  collectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: radii.lg, paddingVertical: 14 },
  collectTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});

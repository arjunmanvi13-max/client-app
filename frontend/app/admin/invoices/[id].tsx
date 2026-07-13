import { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { BusinessEntity, Permission } from "../../../src/rbac";
import { formatDate, formatDateTime } from "../../../src/dateFormat";

const API_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

type Item = {
  id: string; description: string; line_total: number; amount_paid: number; balance_due: number;
};

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function statusStyle(status: string) {
  const s = status?.replace("partial", "partially_paid");
  if (s === "paid") return { bg: "#DCFCE7", fg: "#15803D" };
  if (s === "partially_paid") return { bg: "#FEF3C7", fg: "#B45309" };
  if (s === "overdue") return { bg: "#FEE2E2", fg: "#B91C1C" };
  if (s === "cancelled" || s === "refunded") return { bg: "#F1F5F9", fg: "#64748B" };
  return { bg: "#EFF6FF", fg: "#1E40AF" };
}

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canCollect = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS)
    || userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);
  const canManage = userHasPermission(user, Permission.MANAGE_ACCESS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS, BusinessEntity.PWS);

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<any>(null);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"Cash" | "Online">("Cash");
  const [referenceId, setReferenceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      setInvoice(data);
      const init: Record<string, string> = {};
      (data.items || []).forEach((it: Item) => {
        if (it.balance_due > 0) init[it.id] = String(it.balance_due);
      });
      setAlloc(init);
    } catch {
      setInvoice(null);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const payTotal = useMemo(() => {
    return Object.entries(alloc).reduce((sum, [, v]) => sum + (parseInt(v || "0", 10) || 0), 0);
  }, [alloc]);

  const submitPayment = async () => {
    if (!canCollect) return;
    const allocations = Object.entries(alloc)
      .map(([item_id, v]) => ({ item_id, amount: parseInt(v || "0", 10) }))
      .filter((a) => a.amount > 0);
    if (!allocations.length) { Alert.alert("Enter at least one allocation"); return; }
    if (mode === "Online" && !referenceId.trim()) { Alert.alert("Reference ID required"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/invoices/${id}/payments`, {
        amount: payTotal,
        payment_mode: mode,
        reference_id: referenceId || null,
        allocations,
      });
      Alert.alert("Recorded", `Payment saved. Receipt: ${data.receipt_number || data.payment?.receipt_number || "—"}`);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Payment failed");
    } finally { setSubmitting(false); }
  };

  const issueInvoice = async () => {
    try {
      await api.post(`/invoices/${id}/issue`);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Issue failed");
    }
  };

  const cancelInvoice = async () => {
    Alert.alert("Cancel invoice?", "Only unpaid invoices can be cancelled.", [
      { text: "No", style: "cancel" },
      { text: "Cancel invoice", style: "destructive", onPress: async () => {
        try {
          await api.post(`/invoices/${id}/cancel`, { reason: "Cancelled by admin" });
          await load();
        } catch (e: any) {
          Alert.alert("Error", e?.response?.data?.detail || "Cancel failed");
        }
      }},
    ]);
  };

  const submitRefund = async () => {
    if (!refundPaymentId || !refundReason.trim()) return;
    const payment = (invoice.payments || []).find((p: any) => p.id === refundPaymentId);
    if (!payment) return;
    setSubmitting(true);
    try {
      await api.post(`/invoices/${id}/refunds`, {
        payment_id: refundPaymentId,
        amount: payment.amount - (payment.refunded_amount || 0),
        reason: refundReason.trim(),
      });
      Alert.alert("Refunded", "Refund recorded with authorization.");
      setRefundPaymentId(null);
      setRefundReason("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Refund failed");
    } finally { setSubmitting(false); }
  };

  const openPdf = (path: string) => {
    const url = `${API_ROOT}/api${path}`;
    if (Platform.OS === "web" && typeof window !== "undefined") window.open(url, "_blank");
  };

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} /></SafeAreaView>;
  if (!invoice) return <SafeAreaView style={s.safe}><Text style={s.empty}>Invoice not found</Text></SafeAreaView>;

  const st = statusStyle(invoice.status);
  const canPay = canCollect && invoice.balance_due > 0 && !["paid", "cancelled", "refunded"].includes(invoice.status);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={20} color="#64748B" />
          <Text style={s.backTxt}>Back</Text>
        </TouchableOpacity>
        <Text style={s.h1}>{invoice.invoice_number}</Text>
        <Text style={s.sub}>
          {invoice.person_name} · {invoice.entity_id?.toUpperCase()} · Issue {formatDate(invoice.issue_date)} · Due {formatDate(invoice.due_date)}
        </Text>
        <View style={[s.statusPill, { backgroundColor: st.bg, alignSelf: "flex-start" }]}>
          <Text style={[s.statusTxt, { color: st.fg }]}>{invoice.status}</Text>
        </View>

        <View style={s.summary}>
          <View style={s.sumBlock}><Text style={s.sumVal}>{inr(invoice.total_amount)}</Text><Text style={s.sumLbl}>Total</Text></View>
          <View style={s.sumBlock}><Text style={[s.sumVal, { color: "#15803D" }]}>{inr(invoice.amount_paid)}</Text><Text style={s.sumLbl}>Paid</Text></View>
          <View style={s.sumBlock}><Text style={[s.sumVal, { color: "#B45309" }]}>{inr(invoice.outstanding_amount ?? invoice.balance_due)}</Text><Text style={s.sumLbl}>Outstanding</Text></View>
        </View>

        {(invoice.concession_amount > 0 || invoice.tax_amount > 0) && (
          <Text style={s.meta}>
            {invoice.concession_amount > 0 ? `Concession ${inr(invoice.concession_amount)}` : ""}
            {invoice.tax_amount > 0 ? ` · Tax ${inr(invoice.tax_amount)} (${invoice.tax_rate_percent}%)` : ""}
          </Text>
        )}

        <View style={s.pdfRow}>
          <TouchableOpacity style={s.pdfBtn} onPress={() => openPdf(`/invoices/${id}/pdf`)}>
            <Feather name="file-text" size={16} color="#1E40AF" />
            <Text style={s.pdfTxt}>Invoice PDF</Text>
          </TouchableOpacity>
          {canManage && invoice.status === "draft" && (
            <TouchableOpacity style={s.issueBtn} onPress={issueInvoice}>
              <Text style={s.issueTxt}>Issue</Text>
            </TouchableOpacity>
          )}
          {canManage && !["paid", "cancelled", "refunded"].includes(invoice.status) && invoice.amount_paid === 0 && (
            <TouchableOpacity style={s.cancelBtn} onPress={cancelInvoice}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.section}>Line items</Text>
        {(invoice.items || []).map((it: Item) => (
          <View key={it.id} style={s.lineRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.lineDesc}>{it.description}</Text>
              <Text style={s.lineMeta}>{inr(it.line_total)} · paid {inr(it.amount_paid)} · due {inr(it.balance_due)}</Text>
            </View>
            {it.balance_due > 0 && canPay && (
              <TextInput
                style={s.allocInput}
                keyboardType="numeric"
                value={alloc[it.id] ?? ""}
                onChangeText={(v) => setAlloc((p) => ({ ...p, [it.id]: v }))}
                placeholder="0"
              />
            )}
          </View>
        ))}

        {canPay && (
          <>
            <Text style={s.section}>Record payment (partial allowed)</Text>
            <View style={s.modeRow}>
              {(["Cash", "Online"] as const).map((m) => (
                <TouchableOpacity key={m} style={[s.modeChip, mode === m && s.modeChipOn]} onPress={() => setMode(m)}>
                  <Text style={[s.modeTxt, mode === m && s.modeTxtOn]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mode === "Online" && (
              <TextInput style={s.input} value={referenceId} onChangeText={setReferenceId} placeholder="Reference ID" placeholderTextColor="#94A3B8" />
            )}
            <Text style={s.payTotal}>Payment total: {inr(payTotal)}</Text>
            <TouchableOpacity style={s.payBtn} onPress={submitPayment} disabled={submitting}>
              <Text style={s.payBtnTxt}>{submitting ? "Saving…" : "Record payment"}</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={s.section}>Payment history</Text>
        {(invoice.payments || []).length === 0 ? (
          <Text style={s.empty}>No payments yet.</Text>
        ) : (invoice.payments || []).map((p: any) => (
          <View key={p.id} style={s.payRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.lineDesc}>{p.receipt_number || p.id.slice(0, 8)}</Text>
              <Text style={s.lineMeta}>{inr(p.amount)} · {p.payment_mode} · {formatDate(p.transaction_date)} · {p.status || "completed"}</Text>
            </View>
            <TouchableOpacity onPress={() => openPdf(`/invoices/receipts/${p.id}/pdf`)}>
              <Feather name="download" size={18} color="#1E40AF" />
            </TouchableOpacity>
            {canManage && p.status !== "refunded" && (
              <TouchableOpacity onPress={() => setRefundPaymentId(p.id)}>
                <Feather name="rotate-ccw" size={18} color="#B45309" />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {refundPaymentId && canManage && (
          <View style={s.refundBox}>
            <Text style={s.section}>Authorize refund</Text>
            <TextInput style={s.input} value={refundReason} onChangeText={setRefundReason} placeholder="Reason (required)" placeholderTextColor="#94A3B8" />
            <TouchableOpacity style={s.cancelBtn} onPress={submitRefund} disabled={submitting}>
              <Text style={s.cancelTxt}>Submit refund</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  backTxt: { color: "#64748B", fontWeight: "600" },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4, marginBottom: 8 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 12 },
  statusTxt: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  summary: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, marginBottom: 8 },
  sumBlock: { flex: 1, alignItems: "center" },
  sumVal: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  sumLbl: { fontSize: 11, color: "#64748B", marginTop: 2 },
  meta: { fontSize: 12, color: "#64748B", marginBottom: 10 },
  pdfRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EFF6FF" },
  pdfTxt: { color: "#1E40AF", fontWeight: "700", fontSize: 13 },
  issueBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#1E40AF" },
  issueTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#FEE2E2" },
  cancelTxt: { color: "#B91C1C", fontWeight: "700", fontSize: 13 },
  section: { fontSize: 12, fontWeight: "800", color: "#0F172A", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 16, marginBottom: 8 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, marginBottom: 8 },
  lineDesc: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  lineMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  allocInput: { width: 72, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, textAlign: "right", backgroundColor: "#fff" },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  modeChipOn: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  modeTxt: { fontWeight: "700", color: "#475569", fontSize: 13 },
  modeTxtOn: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, backgroundColor: "#fff", marginBottom: 10 },
  payTotal: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginBottom: 10 },
  payBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  payBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  payRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, marginBottom: 8 },
  refundBox: { backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FDE68A" },
  empty: { fontSize: 13, color: "#94A3B8", fontStyle: "italic" },
});

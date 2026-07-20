import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, useAuth, userHasPermission } from "../../src/auth";
import { BusinessEntity, Permission } from "../../src/rbac";
import { formatDate, formatMonth, parseToISO, toISODate } from "../../src/dateFormat";
import { useBreakpoint } from "../../src/useBreakpoint";
import { FinanceReportsFilterPanel } from "../../src/components/fees/FinanceReportsFilterPanel";
import {
  clampHistoryRange, defaultHistoryRange, filterFinanceFees, historyMinDate,
  monthKey, reportViewFromParam,
  type FinanceCentre, type FinanceEntity, type MonthSplit, type ReportView,
} from "../../src/fees/financeReportsFilters";

type Fee = {
  id: string; player_id: string; player_name: string;
  centre: string; sport: string; category: string;
  entity_id?: string; organization?: string;
  fee_type: "Registration" | "Monthly" | "Transport" | "Uniform" | "Kit" | "Tournament" | "Books" | "Event" | "Other";
  amount: number; amount_due: number;
  period_month: string; due_date: string;
  status: "due" | "paid";
  payment_mode?: string; reference_id?: string; paid_at?: string;
};

function inr(n?: number) { return `₹${(n ?? 0).toLocaleString("en-IN")}`; }

export default function FeesScreen() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string | string[] }>();
  const { user } = useAuth();
  const { horizontalPadding } = useBreakpoint();
  const [fees, setFees] = useState<Fee[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [centre, setCentre] = useState<FinanceCentre>("all");
  const [entity, setEntity] = useState<FinanceEntity>("alpha");
  const [reportView, setReportView] = useState<ReportView>("current_month");
  const [monthSplit, setMonthSplit] = useState<MonthSplit>("dues");
  const defaultRange = defaultHistoryRange();
  const [historyFrom, setHistoryFrom] = useState(() => formatDate(defaultRange.from));
  const [historyTo, setHistoryTo] = useState(() => formatDate(defaultRange.to));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collectFee, setCollectFee] = useState<Fee | null>(null);
  const [editFee, setEditFee] = useState<Fee | null>(null);

  const allowed = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS)
    || userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);
  const canViewPws = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS);
  const canViewAlpha = userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);
  const showEntityFilter = canViewPws && canViewAlpha;
  const showVenue = entity !== "pws";

  useEffect(() => {
    const fromParam = reportViewFromParam(tabParam);
    if (fromParam) setReportView(fromParam);
  }, [tabParam]);

  useEffect(() => {
    if (!showEntityFilter) {
      setEntity(canViewAlpha ? "alpha" : "pws");
    }
  }, [showEntityFilter, canViewAlpha]);

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (entity !== "all") params.entity_id = entity;
      if (centre !== "all") params.centre = centre;
      const [f, d] = await Promise.all([
        api.get("/fees", { params }),
        api.get("/fees/dashboard", { params }),
      ]);
      setFees(f.data);
      setDash(d.data);
    } catch {} finally { setLoading(false); }
  }, [allowed, entity, centre]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const historyBounds = useMemo(() => {
    const fromIso = parseToISO(historyFrom) || defaultRange.from;
    const toIso = parseToISO(historyTo) || defaultRange.to;
    return clampHistoryRange(fromIso, toIso);
  }, [historyFrom, historyTo, defaultRange.from, defaultRange.to]);

  const thisMonth = monthKey();
  const filtered = useMemo(
    () => filterFinanceFees(fees, {
      entity,
      centre,
      reportView,
      monthSplit,
      historyFrom: historyBounds.from,
      historyTo: historyBounds.to,
      thisMonth,
    }),
    [fees, entity, centre, reportView, monthSplit, historyBounds, thisMonth],
  );

  const entityOverline = entity === "all" ? "PWS & ALPHA" : entity === "pws" ? "PWS" : "ALPHA";

  const canDiscount = userHasPermission(user, Permission.MANAGE_ACCESS);
  const canCollect = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS)
    || userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);

  const dashCards = useMemo(() => {
    if (!dash) return [];
    const cards: { key: string; title: string; data: Record<string, number> }[] = [];
    if (entity !== "pws" && dash.by_centre) {
      const centres = centre === "all" ? ["Balua", "Harding Park"] : [centre];
      centres.forEach((c) => {
        const d = dash.by_centre?.[c];
        if (d) cards.push({ key: c, title: c, data: d });
      });
    }
    if (entity !== "alpha" && dash.by_entity?.pws) {
      cards.push({ key: "pws", title: "PWS", data: dash.by_entity.pws });
    }
    return cards;
  }, [dash, entity, centre]);

  if (!user) return null;
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Fees</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>view_fees permission required</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="fees-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>FEES · {entityOverline}</Text>
          <Text style={s.h1}>Collection</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: horizontalPadding }}>
        <FinanceReportsFilterPanel
          centre={centre}
          onCentre={setCentre}
          showVenue={showVenue}
          entity={entity}
          onEntity={setEntity}
          showEntity={showEntityFilter}
          reportView={reportView}
          onReportView={setReportView}
          monthSplit={monthSplit}
          onMonthSplit={setMonthSplit}
          historyFrom={historyFrom}
          historyTo={historyTo}
          onHistoryFrom={setHistoryFrom}
          onHistoryTo={setHistoryTo}
          historyMinDate={historyMinDate()}
          historyMaxDate={toISODate()}
        />
      </View>

      {dashCards.length > 0 && (
        <View style={[s.dashRow, { paddingHorizontal: horizontalPadding }]}>
          {dashCards.map(({ key, title, data: d }) => (
            <View key={key} style={s.dashCard}>
              <Text style={s.dashTitle}>{title}</Text>
              <Text style={s.dashLine}>Today: <Text style={{ color: "#16A34A" }}>{inr(d.collected_today)}</Text></Text>
              <Text style={s.dashLine}>Due (this month): <Text style={{ color: "#D97706" }}>{inr(d.due_current_month)}</Text></Text>
              <Text style={s.dashLine}>Past due: <Text style={{ color: "#EF4444" }}>{inr(d.due_past)}</Text></Text>
              <Text style={s.dashSub}>{d.players_with_dues || d.people_with_dues || 0} with dues</Text>
            </View>
          ))}
        </View>
      )}

      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {reportView === "installments" ? (
          <View style={s.empty}><Feather name="clock" size={36} color="#94A3B8" /><Text style={s.emptyTitle}>Coming soon</Text><Text style={s.emptyText}>Installment tracking will be added in a future update.</Text></View>
        ) : loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 32 }} /> :
         filtered.length === 0 ? <Text style={s.emptyTextRow}>No fees in this view.</Text> :
         filtered.map((f) => (
           <View key={f.id} testID={`fee-row-${f.id}`} style={s.feeRow}>
             <View style={[s.feeDot, { backgroundColor: f.status === "paid" ? "#16A34A" : (f.fee_type === "Registration" ? "#1E40AF" : "#EA580C") }]}>
               <Feather name={f.status === "paid" ? "check" : (f.fee_type === "Registration" ? "award" : "calendar")} size={14} color="#fff" />
             </View>
             <View style={{ flex: 1 }}>
               <Text style={s.feeName}>{f.player_name}</Text>
               <Text style={s.feeMeta}>{f.fee_type} · {f.centre} · {f.sport} · {f.category}</Text>
               <Text style={s.feePeriod}>Period: {formatMonth(f.period_month)}{f.paid_at ? ` · paid ${formatDate(f.paid_at)}` : ""}</Text>
               {(f as any).discount_applied > 0 && (
                 <View style={s.discountChip} testID={`fee-discount-chip-${f.id}`}>
                   <Feather name="percent" size={10} color="#0F766E" />
                   <Text style={s.discountChipTxt}>
                     {`-${inr((f as any).discount_applied)}`}
                     {(f as any).discounted_by_name ? ` · by ${(f as any).discounted_by_name}` : ""}
                   </Text>
                 </View>
               )}
             </View>
             <View style={{ alignItems: "flex-end" }}>
               <Text style={s.feeAmt}>{inr(f.amount_due)}</Text>
               {f.status === "due" ? (
                 <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                   {canDiscount && <TouchableOpacity testID={`fee-discount-${f.id}`} style={s.feeEdit} onPress={() => setEditFee(f)}><Feather name="percent" size={12} color="#0F766E" /></TouchableOpacity>}
                   {canCollect && <TouchableOpacity testID={`fee-collect-${f.id}`} style={s.feeCollect} onPress={() => setCollectFee(f)}><Text style={s.feeCollectTxt}>Mark Paid</Text></TouchableOpacity>}
                 </View>
               ) : (
                 <View style={s.paidBadge}><Text style={s.paidBadgeTxt}>{f.payment_mode || "PAID"}</Text></View>
               )}
             </View>
           </View>
         ))}
         <View style={{ height: 60 }} />
      </ScrollView>

      <CollectModal fee={collectFee} onClose={() => setCollectFee(null)} onDone={async () => { setCollectFee(null); await load(); }} />
      <EditModal fee={editFee} onClose={() => setEditFee(null)} onDone={async () => { setEditFee(null); await load(); }} />
    </SafeAreaView>
  );
}

function CollectModal({ fee, onClose, onDone }: { fee: Fee | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"Cash" | "Online">("Cash");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  if (!fee) return null;
  const submit = async () => {
    if (mode === "Online" && !ref.trim()) { Alert.alert("Reference required", "Please enter the online payment reference id."); return; }
    setBusy(true);
    try { await api.post(`/fees/${fee.id}/collect`, { payment_mode: mode, reference_id: ref || undefined }); onDone(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Modal transparent animationType="slide" visible>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Collect fee</Text>
          <Text style={s.modalSub}>{fee.player_name} · {fee.fee_type}</Text>
          <Text style={s.modalAmt}>{inr(fee.amount_due)}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity testID="mode-cash" onPress={() => setMode("Cash")} style={[s.modeBtn, mode === "Cash" && s.modeBtnActive]}><Text style={[s.modeRupee, { color: mode === "Cash" ? "#fff" : "#475569" }]}>₹</Text><Text style={[s.modeBtnTxt, mode === "Cash" && { color: "#fff" }]}>Cash</Text></TouchableOpacity>
            <TouchableOpacity testID="mode-online" onPress={() => setMode("Online")} style={[s.modeBtn, mode === "Online" && s.modeBtnActive]}><Feather name="credit-card" size={16} color={mode === "Online" ? "#fff" : "#475569"} /><Text style={[s.modeBtnTxt, mode === "Online" && { color: "#fff" }]}>Online</Text></TouchableOpacity>
          </View>
          {mode === "Online" && (
            <TextInput testID="collect-ref" placeholder="Reference / Txn ID" placeholderTextColor="#94A3B8" value={ref} onChangeText={setRef} style={s.input} />
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity testID="collect-cancel" style={s.cancelBtn} onPress={onClose}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity testID="collect-confirm" style={[s.saveBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Confirm payment</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditModal({ fee, onClose, onDone }: { fee: Fee | null; onClose: () => void; onDone: () => void }) {
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!fee) return null;
  const amt = parseInt(discount || "0", 10);
  const newDue = Math.max(0, (fee.amount_due || 0) - amt);
  const submit = async () => {
    if (amt <= 0) { Alert.alert("Discount", "Enter a positive discount amount."); return; }
    if (amt > (fee.amount_due || 0)) { Alert.alert("Discount", "Discount cannot exceed the outstanding amount."); return; }
    if (!reason.trim()) { Alert.alert("Reason required", "Please provide a reason for this discount (audit log)."); return; }
    setBusy(true);
    try {
      await api.patch(`/fees/${fee.id}/discount`, { discount_amount: amt, reason: reason.trim() });
      Alert.alert("Discount applied", `New due: ${inr(newDue)}`);
      onDone();
    }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Modal transparent animationType="slide" visible>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.discountHeader}>
            <View style={s.discountIcon}><Feather name="percent" size={18} color="#fff" /></View>
            <View>
              <Text style={s.modalTitle}>Apply discount</Text>
              <Text style={s.modalSub}>Super Admin only · audit-logged</Text>
            </View>
          </View>
          <Text style={s.discountInfo}>{fee.player_name} · {fee.fee_type} · {formatMonth(fee.period_month)}</Text>
          <View style={s.discountAmtRow}>
            <View style={s.discountAmtCol}>
              <Text style={s.discountAmtLabel}>Current due</Text>
              <Text style={s.discountAmtCurrent}>{inr(fee.amount_due)}</Text>
            </View>
            <Feather name="arrow-right" size={16} color="#94A3B8" />
            <View style={s.discountAmtCol}>
              <Text style={s.discountAmtLabel}>New due</Text>
              <Text style={[s.discountAmtNew, { color: amt > 0 ? "#16A34A" : "#0F172A" }]}>{inr(newDue)}</Text>
            </View>
          </View>
          <Text style={s.discountLabel}>Discount amount (₹) *</Text>
          <TextInput testID="discount-amount" keyboardType="numeric" placeholder="0" placeholderTextColor="#94A3B8" value={discount} onChangeText={(v) => setDiscount(v.replace(/[^0-9]/g, ""))} style={s.input} />
          <Text style={s.discountLabel}>Reason for discount *</Text>
          <TextInput testID="discount-reason" placeholder="e.g. Sibling concession, hardship case, scholarship…" placeholderTextColor="#94A3B8" value={reason} onChangeText={setReason} style={[s.input, { minHeight: 64 }]} multiline />
          <Text style={s.discountFootnote}>
            This action will be logged with your name, role, timestamp, and reason. Visible in the audit trail and fee history.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity testID="discount-cancel" style={s.cancelBtn} onPress={onClose}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity testID="discount-confirm" style={[s.saveBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Apply discount</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  dashRow: { flexDirection: "row", gap: 8, paddingTop: 12, flexWrap: "wrap" },
  dashCard: { flex: 1, minWidth: 150, padding: 12, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  dashTitle: { fontSize: 12, fontWeight: "800", color: "#0F172A", letterSpacing: 0.5, marginBottom: 6 },
  dashLine: { fontSize: 12, color: "#475569", marginTop: 2 },
  dashSub: { fontSize: 11, color: "#94A3B8", marginTop: 6 },
  scroll: { paddingTop: 8, paddingBottom: 20 },
  feeRow: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  feeDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  feeName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  feeMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  feePeriod: { fontSize: 10, color: "#94A3B8", marginTop: 1 },
  feeAmt: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  feeCollect: { backgroundColor: "#1E40AF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  feeCollectTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  feeEdit: { backgroundColor: "#0F766E1A", padding: 6, borderRadius: 8 },
  paidBadge: { backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  paidBadgeTxt: { color: "#16A34A", fontSize: 10, fontWeight: "800" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
  emptyText: { color: "#64748B", textAlign: "center" },
  emptyTextRow: { textAlign: "center", color: "#94A3B8", marginTop: 24 },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  modalCard: { padding: 20, paddingBottom: 28, backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  modalSub: { fontSize: 12, color: "#64748B", marginTop: 4 },
  modalAmt: { fontSize: 26, fontWeight: "800", color: "#1E40AF", marginTop: 12 },
  modeBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: "#F1F5F9" },
  modeBtnActive: { backgroundColor: "#1E40AF" },
  modeBtnTxt: { fontSize: 13, fontWeight: "700", color: "#475569" },
  modeRupee: { fontSize: 16, fontWeight: "900", lineHeight: 18 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, marginTop: 12, fontSize: 14 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: "#475569" },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1E40AF", alignItems: "center" },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  discountChip: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#CCFBF1", borderRadius: 999, alignSelf: "flex-start" },
  discountChipTxt: { fontSize: 10, fontWeight: "800", color: "#0F766E", letterSpacing: 0.3 },
  discountHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  discountIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center" },
  discountInfo: { fontSize: 12, color: "#64748B", marginTop: 6, marginBottom: 12 },
  discountAmtRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12, marginBottom: 14 },
  discountAmtCol: { flex: 1, alignItems: "center" },
  discountAmtLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase" },
  discountAmtCurrent: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  discountAmtNew: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  discountLabel: { fontSize: 13, fontWeight: "600", color: "#475569", marginTop: 6, marginBottom: 4 },
  discountFootnote: { fontSize: 11, color: "#94A3B8", marginTop: 10, lineHeight: 16, fontStyle: "italic" },
});

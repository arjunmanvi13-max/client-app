import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, Alert, Platform,
} from "react-native";
import { FormLabel, getApiError } from "../ScreenStates";
import { DATE_PLACEHOLDER, formatDate, maskDisplayDateInput, parseToISO, toISODate } from "../dateFormat";
import { colors, formColors, radii, spacing } from "../theme";
import { fetchExpenseHeads } from "./expenseApi";
import { parseInrInput } from "./expenseFormat";
import type { ExpenseEntityId, ExpenseEntry, ExpenseHead, ExpensePaymentMode, ExpenseUrgency } from "./expenseTypes";
import { EXPENSE_PAYMENT_MODES, EXPENSE_URGENCY_OPTIONS } from "./expenseTypes";

export type ExpenseEntryFormPayload = {
  entity_id: ExpenseEntityId;
  expense_head_id: string;
  expense_date: string;
  amount: number;
  payment_mode: ExpensePaymentMode;
  reference_number?: string;
  sub_category?: string;
  rate?: number;
  quantity?: number;
  urgency?: ExpenseUrgency;
};

type Props = {
  visible: boolean;
  defaultEntity: ExpenseEntityId;
  editing: ExpenseEntry | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: ExpenseEntryFormPayload) => Promise<void>;
};

function urgencyToDate(urgency: ExpenseUrgency): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (urgency === "Tomorrow") d.setDate(d.getDate() + 1);
  if (urgency === "This Week") d.setDate(d.getDate() + 7);
  return toISODate(d);
}

export function ExpenseEntryFormModal({ visible, defaultEntity, editing, saving, onClose, onSubmit }: Props) {
  const [modalEntity, setModalEntity] = useState<ExpenseEntityId>(defaultEntity);
  const [heads, setHeads] = useState<ExpenseHead[]>([]);
  const [headsLoading, setHeadsLoading] = useState(false);
  const [headId, setHeadId] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [rate, setRate] = useState("");
  const [qty, setQty] = useState("");
  const [amount, setAmount] = useState("");
  const [amountManual, setAmountManual] = useState(false);
  const [urgency, setUrgency] = useState<ExpenseUrgency>("Today");
  const [expenseDateDisplay, setExpenseDateDisplay] = useState(() => formatDate(toISODate()));
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>("Cash");
  const [reference, setReference] = useState("");

  const activeHeads = useMemo(() => heads.filter((h) => h.status === "active"), [heads]);
  const selectedHead = useMemo(() => activeHeads.find((h) => h.id === headId) || null, [activeHeads, headId]);
  const referenceRequired = paymentMode !== "Cash";

  const loadHeads = useCallback(async (entity: ExpenseEntityId) => {
    setHeadsLoading(true);
    try {
      setHeads(await fetchExpenseHeads(entity, true));
    } catch (err: unknown) {
      Alert.alert("Could not load heads", getApiError(err));
      setHeads([]);
    } finally {
      setHeadsLoading(false);
    }
  }, []);

  const resetForm = useCallback((entity: ExpenseEntityId) => {
    setModalEntity(entity);
    setHeadId("");
    setSubCategory("");
    setRate("");
    setQty("");
    setAmount("");
    setAmountManual(false);
    setUrgency("Today");
    setExpenseDateDisplay(formatDate(toISODate()));
    setPaymentMode("Cash");
    setReference("");
  }, []);

  useEffect(() => {
    if (!visible) return;
    const entity = editing?.entity_id || defaultEntity;
    resetForm(entity);
    if (editing) {
      setModalEntity(editing.entity_id);
      setHeadId(editing.expense_head_id);
      setSubCategory(editing.sub_category || editing.expense_head_name || "");
      setRate(editing.rate != null ? String(editing.rate) : "");
      setQty(editing.quantity != null ? String(editing.quantity) : "");
      setAmount(String(editing.amount));
      setAmountManual(true);
      setUrgency(editing.urgency || "Today");
      setExpenseDateDisplay(formatDate(editing.expense_date));
      setPaymentMode(editing.payment_mode);
      setReference(editing.reference_number || "");
    }
    loadHeads(entity);
  }, [visible, defaultEntity, editing, loadHeads, resetForm]);

  useEffect(() => {
    if (!visible) return;
    loadHeads(modalEntity);
  }, [modalEntity, visible, loadHeads]);

  useEffect(() => {
    if (selectedHead) {
      setSubCategory(selectedHead.sub_category);
    }
  }, [selectedHead?.id]);

  useEffect(() => {
    if (!visible || editing || headId || activeHeads.length === 0) return;
    setHeadId(activeHeads[0].id);
  }, [visible, editing, headId, activeHeads]);

  useEffect(() => {
    if (!visible || amountManual) return;
    const r = parseFloat(rate) || 0;
    const q = parseFloat(qty) || 0;
    if (r > 0 && q > 0) setAmount(String(Math.round(r * q)));
  }, [rate, qty, amountManual, visible]);

  const onEntityChange = (entity: ExpenseEntityId) => {
    if (entity === modalEntity) return;
    setModalEntity(entity);
    setHeadId("");
    setSubCategory("");
  };

  const onUrgencyChange = (next: ExpenseUrgency) => {
    setUrgency(next);
    setExpenseDateDisplay(formatDate(urgencyToDate(next)));
  };

  const handleSubmit = async () => {
    if (!headId) {
      Alert.alert("Required", "Please choose an expense head.");
      return;
    }
    const isoDate = parseToISO(expenseDateDisplay);
    if (!isoDate) {
      Alert.alert("Invalid date", `Use format ${DATE_PLACEHOLDER}.`);
      return;
    }
    const amt = parseInrInput(amount);
    if (amt <= 0) {
      Alert.alert("Required", "Amount must be greater than zero.");
      return;
    }
    if (referenceRequired && !reference.trim()) {
      Alert.alert("Required", "Reference number is required for non-cash payments.");
      return;
    }
    const rateNum = rate.trim() ? parseFloat(rate) : undefined;
    const qtyNum = qty.trim() ? parseFloat(qty) : undefined;
    await onSubmit({
      entity_id: modalEntity,
      expense_head_id: headId,
      expense_date: isoDate,
      amount: amt,
      payment_mode: paymentMode,
      reference_number: reference.trim() || undefined,
      sub_category: subCategory.trim() || selectedHead?.sub_category,
      rate: rateNum,
      quantity: qtyNum,
      urgency,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={s.title}>{editing ? "Edit Expense" : "Add New Expense"}</Text>
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            <FormLabel label="Choose Entity" />
            <View style={s.row}>
              {(["pws", "alpha"] as ExpenseEntityId[]).map((e) => (
                <TouchableOpacity key={e} style={[s.chip, modalEntity === e && s.chipActive]} onPress={() => onEntityChange(e)}>
                  <Text style={[s.chipTxt, modalEntity === e && s.chipTxtActive]}>{e.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <FormLabel label="Choose Head" />
            {headsLoading ? <Text style={s.hint}>Loading expense heads…</Text> : null}
            {!headsLoading && activeHeads.length === 0 ? (
              <Text style={s.hint}>No active heads for {modalEntity.toUpperCase()}. Add heads in Expense Structure first.</Text>
            ) : (
              <View style={s.headList}>
                {activeHeads.map((h) => (
                  <TouchableOpacity
                    key={h.id}
                    style={[s.headOption, headId === h.id && s.headOptionActive]}
                    onPress={() => setHeadId(h.id)}
                  >
                    <Text style={[s.headOptionTitle, headId === h.id && s.headOptionTitleActive]}>{h.sub_category}</Text>
                    <Text style={[s.headOptionMeta, headId === h.id && s.headOptionMetaActive]}>{h.category_code} · {h.main_category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <FormLabel label="Sub-Category" />
            <TextInput style={s.input} value={subCategory} onChangeText={setSubCategory} placeholder="From selected head" />

            <FormLabel label="Estimated Cost Breakdown" />
            <View style={s.breakdownRow}>
              <View style={s.breakdownCol}>
                <Text style={s.breakdownLabel}>Rate (₹)</Text>
                <TextInput style={s.input} value={rate} onChangeText={(v) => { setAmountManual(false); setRate(v); }} keyboardType="decimal-pad" placeholder="0" />
              </View>
              <View style={s.breakdownCol}>
                <Text style={s.breakdownLabel}>Qty</Text>
                <TextInput style={s.input} value={qty} onChangeText={(v) => { setAmountManual(false); setQty(v); }} keyboardType="decimal-pad" placeholder="0" />
              </View>
              <View style={s.breakdownCol}>
                <Text style={s.breakdownLabel}>Amount (₹)</Text>
                <TextInput
                  style={[s.input, amountManual && s.inputHighlight]}
                  value={amount}
                  onChangeText={(v) => { setAmountManual(true); setAmount(v); }}
                  keyboardType="numeric"
                  placeholder="Auto: Rate × Qty"
                />
              </View>
            </View>

            <FormLabel label="Urgency" />
            <View style={s.row}>
              {EXPENSE_URGENCY_OPTIONS.map((u) => (
                <TouchableOpacity key={u} style={[s.chip, urgency === u && s.chipActive]} onPress={() => onUrgencyChange(u)}>
                  <Text style={[s.chipTxt, urgency === u && s.chipTxtActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FormLabel label={`Required By (${DATE_PLACEHOLDER})`} />
            <TextInput
              style={s.input}
              value={expenseDateDisplay}
              onChangeText={(v) => setExpenseDateDisplay(maskDisplayDateInput(v))}
              placeholder={DATE_PLACEHOLDER}
            />

            <FormLabel label="Payment Method" />
            <View style={s.paymentRow}>
              {EXPENSE_PAYMENT_MODES.map((m) => (
                <TouchableOpacity key={m} style={[s.chip, paymentMode === m && s.chipActive]} onPress={() => setPaymentMode(m)}>
                  <Text style={[s.chipTxt, paymentMode === m && s.chipTxtActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {referenceRequired && (
              <>
                <FormLabel label="Reference Number" />
                <TextInput style={s.input} value={reference} onChangeText={setReference} placeholder="Transaction / Cheque / Ref ID" />
              </>
            )}
          </ScrollView>
          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSubmit} disabled={saving || activeHeads.length === 0}>
              <Text style={s.saveTxt}>{saving ? "Submitting…" : editing ? "Save & Resubmit" : "Submit for Approval"}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, maxWidth: 600, width: "100%", alignSelf: "center", borderWidth: 1, borderColor: colors.border },
  title: { fontSize: 17, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  paymentRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.borderSoft, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 11, fontWeight: "700", color: colors.muted2 },
  chipTxtActive: { color: "#fff" },
  headList: { gap: spacing.sm, marginBottom: spacing.md },
  headOption: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.sm, backgroundColor: colors.surface2 },
  headOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  headOptionTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  headOptionTitleActive: { color: colors.primary },
  headOptionMeta: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  headOptionMetaActive: { color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: Platform.OS === "web" ? 8 : 10, marginBottom: spacing.sm, fontSize: 13, color: colors.ink, backgroundColor: colors.surface },
  inputHighlight: { borderColor: colors.accent },
  breakdownRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  breakdownCol: { flex: 1 },
  breakdownLabel: { fontSize: 10, fontWeight: "700", color: colors.muted2, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.muted2, marginBottom: spacing.md, fontStyle: "italic" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: colors.borderSoft },
  cancelTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: formColors.primary },
  saveTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
});

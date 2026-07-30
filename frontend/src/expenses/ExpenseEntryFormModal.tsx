import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, Alert, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FormLabel, getApiError } from "../ScreenStates";
import { DATE_PLACEHOLDER, formatDate, maskDisplayDateInput, parseToISO, toISODate } from "../dateFormat";
import { colors, formColors, radii, spacing } from "../theme";
import { fetchExpenseHeads } from "./expenseApi";
import { formatInr } from "./expenseFormat";
import { getExpenseLineItems } from "./expenseItemUtils";
import type { ExpenseEntityId, ExpenseEntry, ExpenseHead, ExpenseLineItem, ExpensePaymentMode, ExpenseUrgency } from "./expenseTypes";
import { EXPENSE_PAYMENT_MODES, EXPENSE_URGENCY_OPTIONS } from "./expenseTypes";

export type ExpenseEntryFormPayload = {
  entity_id: ExpenseEntityId;
  expense_head_id: string;
  expense_date: string;
  amount: number;
  payment_mode: ExpensePaymentMode;
  reference_number?: string;
  items: ExpenseLineItem[];
  urgency?: ExpenseUrgency;
};

type ItemRow = {
  id: string;
  itemName: string;
  rate: string;
  qty: string;
};

type Props = {
  visible: boolean;
  defaultEntity: ExpenseEntityId;
  editing: ExpenseEntry | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: ExpenseEntryFormPayload) => Promise<void>;
};

let rowSeq = 0;
function newItemRow(): ItemRow {
  rowSeq += 1;
  return { id: `row-${rowSeq}`, itemName: "", rate: "", qty: "" };
}

function rowAmount(row: ItemRow): number {
  const rate = parseFloat(row.rate) || 0;
  const qty = parseFloat(row.qty) || 0;
  if (rate <= 0 || qty <= 0) return 0;
  return Math.round(rate * qty);
}

function urgencyToDate(urgency: ExpenseUrgency): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (urgency === "Tomorrow") d.setDate(d.getDate() + 1);
  if (urgency === "This Week") d.setDate(d.getDate() + 7);
  return toISODate(d);
}

function itemsFromEntry(entry: ExpenseEntry): ItemRow[] {
  return getExpenseLineItems(entry).map((it) => ({
    id: newItemRow().id,
    itemName: it.item_name,
    rate: String(it.rate),
    qty: String(it.quantity),
  }));
}

export function ExpenseEntryFormModal({ visible, defaultEntity, editing, saving, onClose, onSubmit }: Props) {
  const [modalEntity, setModalEntity] = useState<ExpenseEntityId>(defaultEntity);
  const [heads, setHeads] = useState<ExpenseHead[]>([]);
  const [headsLoading, setHeadsLoading] = useState(false);
  const [headId, setHeadId] = useState("");
  const [itemRows, setItemRows] = useState<ItemRow[]>(() => [newItemRow()]);
  const [urgency, setUrgency] = useState<ExpenseUrgency>("Today");
  const [expenseDateDisplay, setExpenseDateDisplay] = useState(() => formatDate(toISODate()));
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>("Cash");
  const [reference, setReference] = useState("");
  const prevHeadId = useRef("");

  const activeHeads = useMemo(() => heads.filter((h) => h.status === "active"), [heads]);
  const referenceRequired = paymentMode !== "Cash";
  const grandTotal = useMemo(() => itemRows.reduce((sum, row) => sum + rowAmount(row), 0), [itemRows]);

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
    prevHeadId.current = "";
    setItemRows([newItemRow()]);
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
      prevHeadId.current = editing.expense_head_id;
      setItemRows(itemsFromEntry(editing));
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
    if (!visible || editing || headId || activeHeads.length === 0) return;
    const first = activeHeads[0].id;
    setHeadId(first);
    prevHeadId.current = first;
  }, [visible, editing, headId, activeHeads]);

  const selectHead = (id: string) => {
    if (id !== prevHeadId.current) {
      prevHeadId.current = id;
      setItemRows([newItemRow()]);
    }
    setHeadId(id);
  };

  const updateRow = (id: string, patch: Partial<ItemRow>) => {
    setItemRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const addRow = () => setItemRows((rows) => [...rows, newItemRow()]);

  const removeRow = (id: string) => {
    setItemRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)));
  };

  const onEntityChange = (entity: ExpenseEntityId) => {
    if (entity === modalEntity) return;
    setModalEntity(entity);
    setHeadId("");
    prevHeadId.current = "";
    setItemRows([newItemRow()]);
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
    const items: ExpenseLineItem[] = [];
    for (const row of itemRows) {
      const name = row.itemName.trim();
      const rate = parseFloat(row.rate);
      const qty = parseFloat(row.qty);
      const amount = rowAmount(row);
      if (!name) {
        Alert.alert("Required", "Each item needs a name / description.");
        return;
      }
      if (!rate || rate <= 0 || !qty || qty <= 0 || amount <= 0) {
        Alert.alert("Required", `Enter valid rate and quantity for "${name}".`);
        return;
      }
      items.push({ item_name: name, rate, quantity: qty, amount });
    }
    if (grandTotal <= 0) {
      Alert.alert("Required", "Total amount must be greater than zero.");
      return;
    }
    if (referenceRequired && !reference.trim()) {
      Alert.alert("Required", "Reference number is required for non-cash payments.");
      return;
    }
    await onSubmit({
      entity_id: modalEntity,
      expense_head_id: headId,
      expense_date: isoDate,
      amount: grandTotal,
      payment_mode: paymentMode,
      reference_number: reference.trim() || undefined,
      items,
      urgency,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <Text style={s.title}>{editing ? "Edit Expense" : "Add New Expense"}</Text>
          <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
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
                    onPress={() => selectHead(h.id)}
                  >
                    <Text style={[s.headOptionTitle, headId === h.id && s.headOptionTitleActive]}>{h.sub_category}</Text>
                    <Text style={[s.headOptionMeta, headId === h.id && s.headOptionMetaActive]}>{h.category_code} · {h.main_category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <FormLabel label="Line Items" />
            {itemRows.map((row, index) => (
              <View key={row.id} style={s.itemRow}>
                <View style={s.itemRowTop}>
                  <Text style={s.itemIndex}>Item {index + 1}</Text>
                  {itemRows.length > 1 && (
                    <TouchableOpacity onPress={() => removeRow(row.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Feather name="trash-2" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={s.fieldLabel}>Item / Description</Text>
                <TextInput
                  style={s.input}
                  value={row.itemName}
                  onChangeText={(v) => updateRow(row.id, { itemName: v })}
                  placeholder="Describe this item"
                />
                <View style={s.breakdownRow}>
                  <View style={s.breakdownCol}>
                    <Text style={s.fieldLabel}>Rate (₹)</Text>
                    <TextInput
                      style={s.input}
                      value={row.rate}
                      onChangeText={(v) => updateRow(row.id, { rate: v })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                  <View style={s.breakdownCol}>
                    <Text style={s.fieldLabel}>Qty</Text>
                    <TextInput
                      style={s.input}
                      value={row.qty}
                      onChangeText={(v) => updateRow(row.id, { qty: v })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                  <View style={s.breakdownCol}>
                    <Text style={s.fieldLabel}>Amount (₹)</Text>
                    <TextInput
                      style={[s.input, s.inputReadonly]}
                      value={rowAmount(row) > 0 ? String(rowAmount(row)) : ""}
                      editable={false}
                      placeholder="Auto"
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={s.addRowBtn} onPress={addRow}>
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={s.addRowTxt}>Add Another Item</Text>
            </TouchableOpacity>

            <View style={s.grandTotalBox}>
              <Text style={s.grandTotalLabel}>Total Amount (₹)</Text>
              <Text style={s.grandTotalValue}>{formatInr(grandTotal)}</Text>
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
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center", borderWidth: 1, borderColor: colors.border },
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
  itemRow: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    padding: spacing.sm, marginBottom: spacing.sm, backgroundColor: colors.surface2,
  },
  itemRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  itemIndex: { fontSize: 11, fontWeight: "800", color: colors.muted },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: colors.muted2, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: Platform.OS === "web" ? 8 : 10, marginBottom: spacing.sm, fontSize: 13, color: colors.ink, backgroundColor: colors.surface },
  inputReadonly: { backgroundColor: colors.borderSoft, color: colors.muted },
  breakdownRow: { flexDirection: "row", gap: spacing.sm },
  breakdownCol: { flex: 1 },
  addRowBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: spacing.md,
  },
  addRowTxt: { fontSize: 12, fontWeight: "700", color: colors.primary },
  grandTotalBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.primarySofter,
    borderWidth: 1, borderColor: colors.primary, marginBottom: spacing.md,
  },
  grandTotalLabel: { fontSize: 13, fontWeight: "800", color: colors.primary },
  grandTotalValue: { fontSize: 18, fontWeight: "800", color: colors.ink },
  hint: { fontSize: 12, color: colors.muted2, marginBottom: spacing.md, fontStyle: "italic" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: colors.borderSoft },
  cancelTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: formColors.primary },
  saveTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
});

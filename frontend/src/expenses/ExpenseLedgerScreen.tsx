import { useCallback, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth, userHasPermission } from "../auth";
import { BusinessEntity, Permission, isSuperAdminUser } from "../rbac";
import { LoadingState, EmptyState, ErrorState, FormLabel, getApiError } from "../ScreenStates";
import { useBreakpoint } from "../useBreakpoint";
import { formatDate, toISODate } from "../dateFormat";
import {
  createExpenseEntry, deleteExpenseEntry, fetchExpenseEntries, fetchExpenseHeads,
  resubmitExpenseEntry, recallExpenseEntry, updateExpenseEntry, uploadExpenseAttachment,
} from "./expenseApi";
import { formatInr, parseInrInput } from "./expenseFormat";
import type { ExpenseEntityId, ExpenseEntry, ExpenseHead, ExpensePaymentMode, ExpenseTab } from "./expenseTypes";
import { EXPENSE_PAYMENT_MODES } from "./expenseTypes";

const TABS: { key: ExpenseTab; label: string }[] = [
  { key: "all", label: "All Entries" },
  { key: "pending", label: "Pending Approval" },
  { key: "approved", label: "Approved / Finalised" },
  { key: "rejected", label: "Rejected" },
];

function statusStyle(status: string) {
  if (status === "pending") return { bg: "#FEE2E2", color: "#DC2626", label: "Pending" };
  if (status === "approved") return { bg: "#DCFCE7", color: "#16A34A", label: "Approved" };
  if (status === "rejected") return { bg: "#FED7AA", color: "#9A3412", label: "Rejected" };
  return { bg: "#F1F5F9", color: "#64748B", label: status };
}

type Props = {
  entityId: ExpenseEntityId;
  title: string;
  overline: string;
};

export function ExpenseLedgerScreen({ entityId, title, overline }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding } = useBreakpoint();
  const perm = entityId === "pws" ? Permission.CAPTURE_PWS_EXPENSES : Permission.CAPTURE_ALPHA_EXPENSES;
  const entity = entityId === "pws" ? BusinessEntity.PWS : BusinessEntity.ALPHA;
  const canCapture = userHasPermission(user, perm, entity) || isSuperAdminUser(user);
  const role = (user?.role || "").toLowerCase();
  const canView = canCapture || isSuperAdminUser(user)
    || (entityId === "pws" && ["principal", "vice_principal", "pws_admin", "pws_accounts"].includes(role))
    || (entityId === "alpha" && ["admin", "alpha_admin", "alpha_accounts"].includes(role));

  const [tab, setTab] = useState<ExpenseTab>("all");
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [heads, setHeads] = useState<ExpenseHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const [expenseDate, setExpenseDate] = useState(() => toISODate());
  const [headId, setHeadId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>("Cash");
  const [vendor, setVendor] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [rejectTip, setRejectTip] = useState<string | null>(null);

  const activeHeads = useMemo(() => heads.filter((h) => h.status === "active"), [heads]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [e, h] = await Promise.all([
        fetchExpenseEntries(entityId, tab),
        fetchExpenseHeads(entityId, true),
      ]);
      setEntries(e);
      setHeads(h);
    } catch (err: unknown) {
      setError(getApiError(err, "Could not load expenses."));
    } finally {
      setLoading(false);
    }
  }, [entityId, tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resetForm = () => {
    setEditing(null);
    setExpenseDate(toISODate());
    setHeadId(activeHeads[0]?.id || "");
    setAmount("");
    setPaymentMode("Cash");
    setVendor("");
    setReference("");
    setDescription("");
    setVenue("");
    setAttachmentFile(null);
  };

  const openCreate = () => {
    resetForm();
    setHeadId(activeHeads[0]?.id || "");
    setModalOpen(true);
  };

  const openEdit = (entry: ExpenseEntry) => {
    if (entry.status !== "pending" && entry.status !== "rejected") return;
    setEditing(entry);
    setExpenseDate(entry.expense_date);
    setHeadId(entry.expense_head_id);
    setAmount(String(entry.amount));
    setPaymentMode(entry.payment_mode);
    setVendor(entry.vendor_name);
    setReference(entry.reference_number || "");
    setDescription(entry.description || "");
    setVenue(entry.venue || "");
    setModalOpen(true);
  };

  const saveEntry = async () => {
    if (!canCapture) return;
    const amt = parseInrInput(amount);
    if (!headId || !vendor.trim() || amt <= 0) {
      Alert.alert("Missing fields", "Expense head, vendor, and amount are required.");
      return;
    }
    setSaving(true);
    try {
      let entry: ExpenseEntry;
      const payload = {
        entity_id: entityId,
        expense_head_id: headId,
        expense_date: expenseDate,
        amount: amt,
        payment_mode: paymentMode,
        vendor_name: vendor.trim(),
        reference_number: reference.trim() || undefined,
        description: description.trim() || undefined,
        venue: venue.trim() || undefined,
      };
      if (editing) {
        entry = await updateExpenseEntry(editing.id, payload);
      } else {
        entry = await createExpenseEntry(payload);
      }
      if (attachmentFile) {
        await uploadExpenseAttachment(entry.id, attachmentFile, attachmentFile.name);
      }
      setModalOpen(false);
      resetForm();
      await load();
    } catch (err: unknown) {
      Alert.alert("Save failed", getApiError(err, "Could not save expense."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (entry: ExpenseEntry) => {
    Alert.alert("Delete entry?", "This pending entry will be permanently removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await deleteExpenseEntry(entry.id);
            await load();
          } catch (err: unknown) {
            Alert.alert("Delete failed", getApiError(err));
          }
        },
      },
    ]);
  };

  const handleResubmit = async (entry: ExpenseEntry) => {
    try {
      await resubmitExpenseEntry(entry.id);
      await load();
    } catch (err: unknown) {
      Alert.alert("Resubmit failed", getApiError(err));
    }
  };

  const handleRecall = (entry: ExpenseEntry) => {
    Alert.alert("Recall approved expense?", "Super Admin only — entry will be cancelled.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Recall", style: "destructive", onPress: async () => {
          try {
            await recallExpenseEntry(entry.id);
            await load();
          } catch (err: unknown) {
            Alert.alert("Recall failed", getApiError(err));
          }
        },
      },
    ]);
  };

  if (!user) return null;
  if (!canView) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>Expense access required</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>{overline}</Text>
          <Text style={s.h1}>{title}</Text>
        </View>
        {canCapture && (
          <TouchableOpacity style={s.addBtn} onPress={openCreate} testID="add-expense">
            <Feather name="plus" size={14} color="#fff" />
            <Text style={s.addBtnTxt}>Add New Expense</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.tabs, { paddingHorizontal: horizontalPadding }]}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding }]}>
        {loading && <LoadingState message="Loading expenses…" />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && entries.length === 0 && <EmptyState title="No expense entries" subtitle="Add a new expense to get started." />}
        {!loading && !error && entries.map((entry) => {
          const st = statusStyle(entry.status);
          const editable = entry.status === "pending" || entry.status === "rejected";
          return (
            <View key={entry.id} style={s.card}>
              <View style={s.cardTop}>
                <View>
                  <Text style={s.reqId}>{entry.request_id}</Text>
                  <Text style={s.cardTitle}>{entry.expense_head_name || entry.main_category || "Expense"}</Text>
                  <Text style={s.cardMeta}>{formatDate(entry.expense_date)} · {entry.vendor_name}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={s.amount}>{formatInr(entry.amount)}</Text>
                  <Pressable
                    onHoverIn={() => entry.rejection_reason && setRejectTip(entry.rejection_reason)}
                    onHoverOut={() => setRejectTip(null)}
                  >
                    <View style={[s.badge, { backgroundColor: st.bg }]}>
                      <Text style={[s.badgeTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </Pressable>
                  {entry.budget_alert?.over_budget && (
                    <View style={[s.badge, { backgroundColor: "#FEF3C7" }]}>
                      <Text style={[s.badgeTxt, { color: "#B45309" }]}>Over Budget</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={s.cardSub}>{entry.payment_mode}{entry.reference_number ? ` · Ref ${entry.reference_number}` : ""}</Text>
              {entry.description ? <Text style={s.cardDesc}>{entry.description}</Text> : null}
              {rejectTip && entry.rejection_reason ? (
                <Text style={s.rejectTip}>Rejection: {entry.rejection_reason}</Text>
              ) : null}
              <View style={s.actions}>
                {editable && canCapture && (
                  <>
                    <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(entry)}><Text style={s.actionTxt}>Edit{entry.status === "rejected" ? " & Resubmit" : ""}</Text></TouchableOpacity>
                    {entry.status === "pending" && (
                      <TouchableOpacity style={[s.actionBtn, s.actionDanger]} onPress={() => handleDelete(entry)}><Text style={[s.actionTxt, { color: "#DC2626" }]}>Delete</Text></TouchableOpacity>
                    )}
                    {entry.status === "rejected" && (
                      <TouchableOpacity style={s.actionBtn} onPress={() => handleResubmit(entry)}><Text style={s.actionTxt}>Resubmit</Text></TouchableOpacity>
                    )}
                  </>
                )}
                {entry.status === "approved" && isSuperAdminUser(user) && (
                  <TouchableOpacity style={[s.actionBtn, s.actionDanger]} onPress={() => handleRecall(entry)}><Text style={[s.actionTxt, { color: "#DC2626" }]}>Recall</Text></TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        <View style={{ height: 48 }} />
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>{editing ? "Edit Expense" : "Add New Expense"}</Text>
            <ScrollView style={{ maxHeight: 480 }}>
              <FormLabel label="Expense Date" />
              <TextInput style={s.input} value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" />
              <FormLabel label="Entity" />
              <TextInput style={[s.input, s.inputDisabled]} value={entityId.toUpperCase()} editable={false} />
              <FormLabel label="Expense Head" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {activeHeads.map((h) => (
                  <TouchableOpacity key={h.id} style={[s.chip, headId === h.id && s.chipActive]} onPress={() => setHeadId(h.id)}>
                    <Text style={[s.chipTxt, headId === h.id && s.chipTxtActive]}>{h.sub_category}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <FormLabel label="Amount (₹ INR)" />
              <TextInput style={s.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="e.g. 15000" />
              <FormLabel label="Payment Mode" />
              <View style={s.chipRow}>
                {EXPENSE_PAYMENT_MODES.map((m) => (
                  <TouchableOpacity key={m} style={[s.chip, paymentMode === m && s.chipActive]} onPress={() => setPaymentMode(m)}>
                    <Text style={[s.chipTxt, paymentMode === m && s.chipTxtActive]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <FormLabel label="Paid To / Vendor" />
              <TextInput style={s.input} value={vendor} onChangeText={setVendor} />
              <FormLabel label="Reference / Invoice / Bill No." />
              <TextInput style={s.input} value={reference} onChangeText={setReference} />
              {entityId === "pws" && (
                <>
                  <FormLabel label="Venue (optional)" />
                  <TextInput style={s.input} value={venue} onChangeText={setVenue} placeholder="Balua / Harding Park" />
                </>
              )}
              <FormLabel label="Description / Remarks" />
              <TextInput style={[s.input, { minHeight: 72 }]} value={description} onChangeText={setDescription} multiline />
              {Platform.OS === "web" && (
                <>
                  <FormLabel label="Receipt / Invoice (PDF or Image)" />
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                    style={{ marginBottom: 12 }}
                  />
                </>
              )}
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalOpen(false)}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={saveEntry} disabled={saving}>
                <Text style={s.saveTxt}>{saving ? "Saving…" : editing ? "Save & Resubmit" : "Submit for Approval"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff" },
  backBtn: { padding: 4 },
  overline: { fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.8 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#1E40AF", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  addBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  tabs: { gap: 8, paddingVertical: 10 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#E2E8F0" },
  tabActive: { backgroundColor: "#1E40AF" },
  tabTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  tabTxtActive: { color: "#fff" },
  scroll: { paddingTop: 8, paddingBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  reqId: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  cardMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
  cardSub: { fontSize: 11, color: "#64748B", marginTop: 8 },
  cardDesc: { fontSize: 12, color: "#334155", marginTop: 4 },
  rejectTip: { fontSize: 11, color: "#9A3412", marginTop: 6, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#F1F5F9" },
  actionDanger: { backgroundColor: "#FEE2E2" },
  actionTxt: { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, maxWidth: 560, width: "100%", alignSelf: "center" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: Platform.OS === "web" ? 8 : 10, marginBottom: 10, fontSize: 13, color: "#0F172A", backgroundColor: "#fff" },
  inputDisabled: { backgroundColor: "#F1F5F9", color: "#64748B" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F1F5F9", marginRight: 6 },
  chipActive: { backgroundColor: "#1E40AF" },
  chipTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#F1F5F9" },
  cancelTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#1E40AF" },
  saveTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
});

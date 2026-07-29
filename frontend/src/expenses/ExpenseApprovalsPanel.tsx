import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../ScreenStates";
import { formatDate } from "../dateFormat";
import {
  approveExpenseEntry, bulkApproveExpenses, fetchExpenseApprovals, fetchExpenseAttachment, rejectExpenseEntry,
} from "../expenses/expenseApi";
import { formatInr } from "../expenses/expenseFormat";
import type { ExpenseEntry, ExpenseEntityId } from "../expenses/expenseTypes";

type Props = {
  entityFilter?: ExpenseEntityId;
  onUpdated?: () => void;
};

export function ExpenseApprovalsPanel({ entityFilter, onUpdated }: Props) {
  const [rows, setRows] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<ExpenseEntry | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchExpenseApprovals(entityFilter, "pending");
      setRows(data);
      setSelected(new Set());
    } catch (err: unknown) {
      setError(getApiError(err, "Could not load expense approvals."));
    } finally {
      setLoading(false);
    }
  }, [entityFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async (entry: ExpenseEntry) => {
    setBusy(true);
    try {
      await approveExpenseEntry(entry.id);
      setRows((prev) => prev.filter((r) => r.id !== entry.id));
      onUpdated?.();
    } catch (err: unknown) {
      Alert.alert("Approve failed", getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await bulkApproveExpenses(Array.from(selected));
      await load();
      onUpdated?.();
    } catch (err: unknown) {
      Alert.alert("Bulk approve failed", getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || rejectReason.trim().length < 3) {
      Alert.alert("Reason required", "Enter a rejection reason (min 3 characters).");
      return;
    }
    setBusy(true);
    try {
      await rejectExpenseEntry(rejectTarget.id, rejectReason.trim());
      setRejectTarget(null);
      setRejectReason("");
      await load();
      onUpdated?.();
    } catch (err: unknown) {
      Alert.alert("Reject failed", getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const previewReceipt = async (attachmentId?: string | null) => {
    if (!attachmentId) {
      Alert.alert("No receipt", "No attachment uploaded for this entry.");
      return;
    }
    try {
      const att = await fetchExpenseAttachment(attachmentId);
      if (typeof window !== "undefined") window.open(att.data_url, "_blank");
    } catch (err: unknown) {
      Alert.alert("Preview failed", getApiError(err));
    }
  };

  if (loading) return <LoadingState message="Loading expense approvals…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (rows.length === 0) return <EmptyState title="No pending expenses" subtitle="Expense approval requests will appear here." />;

  return (
    <View>
      {selected.size > 0 && (
        <TouchableOpacity style={s.bulkBtn} onPress={handleBulkApprove} disabled={busy}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={s.bulkTxt}>Approve Selected ({selected.size})</Text>
        </TouchableOpacity>
      )}
      {rows.map((row) => (
        <View key={row.id} style={s.card}>
          <View style={s.cardHeader}>
            <TouchableOpacity onPress={() => toggleSelect(row.id)} style={s.checkBox}>
              <Feather name={selected.has(row.id) ? "check-square" : "square"} size={18} color="#1E40AF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.reqId}>{row.request_id}</Text>
              <Text style={s.title}>{row.expense_head_name || "Expense"} · {formatInr(row.amount)}</Text>
              <Text style={s.meta}>{formatDate(row.expense_date)} · {row.entity_id.toUpperCase()} · {row.entered_by_name || row.created_by_name}</Text>
              <Text style={s.meta}>{row.payment_mode} · {row.vendor_name}</Text>
              {row.budget_alert?.over_budget && (
                <View style={s.overBudget}><Text style={s.overBudgetTxt}>⚠ Over-Budget Alert — review before approving</Text></View>
              )}
            </View>
          </View>
          <View style={s.actions}>
            {row.attachment_id && (
              <TouchableOpacity style={s.btnGhost} onPress={() => previewReceipt(row.attachment_id)}>
                <Feather name="paperclip" size={14} color="#1E40AF" /><Text style={s.btnGhostTxt}>Receipt</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.btnApprove} onPress={() => handleApprove(row)} disabled={busy}>
              <Text style={s.btnApproveTxt}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnReject} onPress={() => { setRejectTarget(row); setRejectReason(""); }} disabled={busy}>
              <Text style={s.btnRejectTxt}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setRejectTarget(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Reject Expense</Text>
            <Text style={s.modalSub}>Rejection reason is mandatory and visible to the data entry user.</Text>
            <TextInput
              style={s.textArea}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              placeholder="Enter rejection reason…"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnGhost} onPress={() => setRejectTarget(null)}><Text style={s.btnGhostTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.btnReject} onPress={submitReject} disabled={busy}><Text style={s.btnRejectTxt}>Confirm Reject</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bulkBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#16A34A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 12 },
  bulkTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  cardHeader: { flexDirection: "row", gap: 10 },
  checkBox: { paddingTop: 2 },
  reqId: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
  title: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  meta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  overBudget: { marginTop: 6, backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  overBudgetTxt: { fontSize: 10, fontWeight: "700", color: "#B45309" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  btnGhost: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F1F5F9" },
  btnGhostTxt: { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  btnApprove: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#16A34A" },
  btnApproveTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  btnReject: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#FEE2E2" },
  btnRejectTxt: { fontSize: 11, fontWeight: "700", color: "#DC2626" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, maxWidth: 480, width: "100%", alignSelf: "center" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  modalSub: { fontSize: 12, color: "#64748B", marginVertical: 8 },
  textArea: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, minHeight: 90, padding: 10, fontSize: 13, marginBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});

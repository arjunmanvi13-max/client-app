import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, Alert,
  LayoutAnimation, Platform, UIManager, Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../ScreenStates";
import { formatDate, formatDateTime } from "../dateFormat";
import { colors, radii, spacing } from "../theme";
import {
  approveExpenseEntry, bulkApproveExpenses, fetchExpenseApprovals, fetchExpenseAttachment, rejectExpenseEntry,
} from "./expenseApi";
import { formatInr } from "./expenseFormat";
import { expenseItemsSummary } from "./expenseItemUtils";
import { ExpenseItemsBreakdown } from "./ExpenseItemsBreakdown";
import type { ExpenseAuditEntry, ExpenseEntry, ExpenseEntityId } from "./expenseTypes";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  entityFilter?: ExpenseEntityId;
  onUpdated?: () => void;
};

function formatRole(role?: string | null): string {
  if (!role) return "";
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function auditLabel(action: string): string {
  const labels: Record<string, string> = {
    created: "Submitted",
    approved: "Approved",
    rejected: "Rejected",
    updated: "Updated",
    resubmitted: "Resubmitted",
    cancelled: "Cancelled",
  };
  return labels[action] || action.charAt(0).toUpperCase() + action.slice(1);
}

function EntityBadge({ entityId }: { entityId: ExpenseEntityId }) {
  const isPws = entityId === "pws";
  return (
    <View style={[s.badge, { backgroundColor: isPws ? colors.primarySofter : "#EDE9FE" }]}>
      <Text style={[s.badgeTxt, { color: isPws ? colors.primary : "#6D28D9" }]}>{entityId.toUpperCase()}</Text>
    </View>
  );
}

function ToneBadge({ label, tone }: { label: string; tone: "payment" | "urgency" | "warn" }) {
  const toneStyle =
    tone === "urgency"
      ? { bg: "#FEF3C7", color: "#B45309" }
      : tone === "warn"
        ? { bg: colors.dangerSoft, color: colors.danger }
        : { bg: colors.borderSoft, color: colors.muted };
  return (
    <View style={[s.badge, { backgroundColor: toneStyle.bg }]}>
      <Text style={[s.badgeTxt, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

function AuditTimeline({ trail }: { trail: ExpenseAuditEntry[] }) {
  if (!trail.length) return null;
  return (
    <View style={s.auditBlock}>
      <Text style={s.auditTitle}>Status History</Text>
      {trail.map((log) => (
        <View key={log.id} style={s.auditItem}>
          <View style={s.auditDot} />
          <View style={{ flex: 1 }}>
            <Text style={s.auditAction}>
              {auditLabel(log.action)}
              {log.user_name ? ` · ${log.user_name}` : ""}
              {log.user_role ? ` (${formatRole(log.user_role)})` : ""}
            </Text>
            {log.note ? <Text style={s.auditNote}>{log.note}</Text> : null}
            <Text style={s.auditAt}>{formatDateTime(log.at)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ExpenseApprovalCard({
  row,
  expanded,
  selected,
  busy,
  onToggleExpand,
  onToggleSelect,
  onApprove,
  onReject,
  onPreviewReceipt,
}: {
  row: ExpenseEntry;
  expanded: boolean;
  selected: boolean;
  busy: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  onPreviewReceipt: () => void;
}) {
  const expandAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [expanded, expandAnim]);

  const headLabel = row.expense_head_name || row.main_category || "Expense";
  const summaryLabel = expenseItemsSummary(row);
  const submitter = row.entered_by_name || row.created_by_name || "—";
  const submitterRole = formatRole(row.entered_by_role || row.created_by_role);

  return (
    <View style={[s.card, expanded && s.cardExpanded]}>
      <Pressable onPress={onToggleExpand} style={({ pressed }) => [s.cardTap, pressed && s.cardTapPressed]}>
        <View style={s.cardHeader}>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onToggleSelect(); }}
            style={s.checkBox}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={selected ? "check-square" : "square"} size={18} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.reqId}>{row.request_id}</Text>
            <Text style={s.title} numberOfLines={expanded ? undefined : 1}>
              {summaryLabel}
            </Text>
            <View style={s.badgeRow}>
              <EntityBadge entityId={row.entity_id} />
              <ToneBadge label={row.payment_mode} tone="payment" />
              {row.urgency ? <ToneBadge label={row.urgency} tone="urgency" /> : null}
            </View>
            <Text style={s.meta}>
              {formatDate(row.expense_date)} · {submitter}{submitterRole ? ` · ${submitterRole}` : ""}
            </Text>
            {row.budget_alert?.over_budget && (
              <View style={s.overBudget}>
                <Text style={s.overBudgetTxt}>Over-budget — review before approving</Text>
              </View>
            )}
          </View>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted2} style={s.chevron} />
        </View>
      </Pressable>

      <Animated.View
        style={[
          s.expandWrap,
          {
            opacity: expandAnim,
            maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 900] }),
          },
        ]}
        pointerEvents={expanded ? "auto" : "none"}
      >
        <View style={s.details}>
          <DetailRow label="Entity" value={row.entity_id.toUpperCase()} />
          <DetailRow label="Head" value={headLabel} />
          <View style={s.itemsBlock}>
            <Text style={s.itemsTitle}>Line Items</Text>
            <ExpenseItemsBreakdown entry={row} />
          </View>
          <DetailRow
            label="Urgency & Date"
            value={`${row.urgency || "—"} · ${formatDate(row.expense_date)}`}
          />
          <DetailRow
            label="Payment"
            value={
              row.reference_number
                ? `${row.payment_mode} · Ref ${row.reference_number}`
                : row.payment_mode
            }
          />
          <DetailRow
            label="Submitted By"
            value={`${submitter}${submitterRole ? ` (${submitterRole})` : ""} · ${formatDateTime(row.created_at)}`}
          />
          {row.description ? <DetailRow label="Notes" value={row.description} /> : null}
          {row.venue ? <DetailRow label="Venue" value={row.venue} /> : null}
          <AuditTimeline trail={row.audit_trail || []} />
        </View>
      </Animated.View>

      <View style={s.actions}>
        {row.attachment_id && (
          <TouchableOpacity style={s.btnGhost} onPress={onPreviewReceipt} disabled={busy}>
            <Feather name="paperclip" size={14} color={colors.primary} />
            <Text style={s.btnGhostTxt}>Receipt</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.btnApprove} onPress={onApprove} disabled={busy}>
          <Text style={s.btnApproveTxt}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnReject} onPress={onReject} disabled={busy}>
          <Text style={s.btnRejectTxt}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ExpenseApprovalsPanel({ entityFilter, onUpdated }: Props) {
  const [rows, setRows] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
      setExpandedId(null);
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

  const toggleExpand = (id: string) => {
    if (Platform.OS !== "web") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleApprove = async (entry: ExpenseEntry) => {
    setBusy(true);
    try {
      await approveExpenseEntry(entry.id);
      setRows((prev) => prev.filter((r) => r.id !== entry.id));
      if (expandedId === entry.id) setExpandedId(null);
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
    const reason = rejectReason.trim();
    if (!rejectTarget || reason.length < 3) {
      Alert.alert("Reason required", "Enter a rejection comment before confirming (minimum 3 characters).");
      return;
    }
    setBusy(true);
    try {
      await rejectExpenseEntry(rejectTarget.id, reason);
      setRejectTarget(null);
      setRejectReason("");
      setRows((prev) => prev.filter((r) => r.id !== rejectTarget.id));
      if (expandedId === rejectTarget.id) setExpandedId(null);
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
  if (rows.length === 0) {
    return <EmptyState title="No pending expenses" subtitle="Expense approval requests will appear here." />;
  }

  return (
    <View>
      {selected.size > 0 && (
        <TouchableOpacity style={s.bulkBtn} onPress={handleBulkApprove} disabled={busy}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={s.bulkTxt}>Approve Selected ({selected.size})</Text>
        </TouchableOpacity>
      )}
      {rows.map((row) => (
        <ExpenseApprovalCard
          key={row.id}
          row={row}
          expanded={expandedId === row.id}
          selected={selected.has(row.id)}
          busy={busy}
          onToggleExpand={() => toggleExpand(row.id)}
          onToggleSelect={() => toggleSelect(row.id)}
          onApprove={() => handleApprove(row)}
          onReject={() => { setRejectTarget(row); setRejectReason(""); }}
          onPreviewReceipt={() => previewReceipt(row.attachment_id)}
        />
      ))}

      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setRejectTarget(null)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Reject Expense</Text>
            <Text style={s.modalSub}>
              {rejectTarget?.request_id} — {rejectTarget?.sub_category || rejectTarget?.expense_head_name}
            </Text>
            <Text style={s.modalHint}>
              A rejection comment is required. The submitter will see this on their Rejected tab and can edit and resubmit.
            </Text>
            <TextInput
              style={s.textArea}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              placeholder="Enter rejection reason…"
              autoFocus={Platform.OS === "web"}
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnGhost} onPress={() => setRejectTarget(null)} disabled={busy}>
                <Text style={s.btnGhostTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnReject, rejectReason.trim().length < 3 && s.btnRejectDisabled]}
                onPress={submitReject}
                disabled={busy || rejectReason.trim().length < 3}
              >
                <Text style={s.btnRejectTxt}>{busy ? "Rejecting…" : "Confirm Reject"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bulkBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radii.sm, marginBottom: spacing.md,
  },
  bulkTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" } as object,
      default: {},
    }),
  },
  cardExpanded: { borderColor: colors.primary, backgroundColor: colors.surface },
  cardTap: { marginHorizontal: -spacing.xs },
  cardTapPressed: { opacity: 0.92 },
  cardHeader: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  checkBox: { paddingTop: 2 },
  reqId: { fontSize: 10, fontWeight: "700", color: colors.muted2, letterSpacing: 0.4 },
  title: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 4, lineHeight: 20 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  badgeTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  meta: { fontSize: 11, color: colors.muted2, marginTop: 6 },
  chevron: { marginTop: 4 },
  overBudget: {
    marginTop: 8, backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radii.sm, alignSelf: "flex-start",
  },
  overBudgetTxt: { fontSize: 10, fontWeight: "700", color: "#B45309" },
  expandWrap: { overflow: "hidden" },
  details: {
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border,
    gap: 2,
  },
  detailRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: 5 },
  detailLabel: { width: 118, fontSize: 11, fontWeight: "700", color: colors.muted2 },
  detailValue: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.ink, lineHeight: 17 },
  itemsBlock: { marginTop: spacing.sm, marginBottom: spacing.sm },
  itemsTitle: { fontSize: 11, fontWeight: "800", color: colors.muted, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.6 },
  auditBlock: { marginTop: spacing.md, paddingTop: spacing.sm },
  auditTitle: { fontSize: 11, fontWeight: "800", color: colors.muted, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.6 },
  auditItem: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  auditDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  auditAction: { fontSize: 12, fontWeight: "700", color: colors.ink },
  auditNote: { fontSize: 11, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  auditAt: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  btnGhost: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: radii.sm, backgroundColor: colors.borderSoft,
  },
  btnGhostTxt: { fontSize: 11, fontWeight: "700", color: colors.primary },
  btnApprove: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm, backgroundColor: colors.success },
  btnApproveTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  btnReject: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm, backgroundColor: colors.dangerSoft },
  btnRejectDisabled: { opacity: 0.5 },
  btnRejectTxt: { fontSize: 11, fontWeight: "700", color: colors.danger },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: spacing.lg },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg,
    maxWidth: 480, width: "100%", alignSelf: "center", borderWidth: 1, borderColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  modalSub: { fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: 4 },
  modalHint: { fontSize: 12, color: colors.muted2, marginVertical: spacing.sm, lineHeight: 18 },
  textArea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, minHeight: 100,
    padding: spacing.sm, fontSize: 13, marginBottom: spacing.md, color: colors.ink, backgroundColor: colors.surface2,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
});

import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../src/auth";
import { Permission } from "../../src/rbac";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../../src/ScreenStates";
import { formatDateTime } from "../../src/dateFormat";
import { useBreakpoint } from "../../src/useBreakpoint";
import {
  APPROVAL_CATEGORY_FILTERS,
  CATEGORY_LABELS,
  formatInr,
  financialSummary,
  normalizeApprovalRequest,
  roleBadgeLabel,
  type ApprovalCategory,
  type ApprovalRequest,
  type ApprovalStatus,
} from "../../src/approvalTypes";
import { colors, radii, spacing } from "../../src/theme";

const STATUS_TABS: ApprovalStatus[] = ["pending", "approved", "rejected"];
const RESOLVED_CARD_TTL_MS = 5000;

function statusColor(status: ApprovalStatus) {
  if (status === "pending") return "#D97706";
  if (status === "approved") return colors.success;
  return colors.danger;
}

function feeOverrideRows(req: ApprovalRequest): Array<{ key: string; defaultVal: unknown; customVal: unknown }> {
  const d = req.details || {};
  const defaults = (d.default_fees || {}) as Record<string, unknown>;
  const custom = (d.custom_fees || {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(defaults), ...Object.keys(custom)]));
  return keys
    .filter((key) => custom[key] != null)
    .map((key) => ({ key, defaultVal: defaults[key], customVal: custom[key] }));
}

function RequestCard({
  req,
  showActions,
  onApprove,
  onModify,
  onReject,
}: {
  req: ApprovalRequest;
  showActions: boolean;
  onApprove: () => void;
  onModify: () => void;
  onReject: () => void;
}) {
  const roleBadge = roleBadgeLabel(req);
  const financeLines = financialSummary(req);
  const isFinancial = req.category !== "user_deactivation";
  const feeRows = req.category === "fee_override_admission" ? feeOverrideRows(req) : [];
  const isPending = req.status === "pending";

  return (
    <View style={[s.card, !isPending && req.status === "approved" && s.cardApproved]} testID={`appr-${req.id}`}>
      <View style={s.cardHeader}>
        <View style={[s.statusDot, { backgroundColor: statusColor(req.status) }]}>
          <Feather
            name={req.status === "pending" ? "clock" : req.status === "approved" ? "check" : "x"}
            size={14}
            color="#fff"
          />
        </View>
        <View style={s.cardHeaderText}>
          <View style={s.tagRow}>
            <Text style={s.categoryTag}>{CATEGORY_LABELS[req.category]}</Text>
            <View style={[s.statusBadge, { backgroundColor: `${statusColor(req.status)}14` }]}>
              <Text style={[s.statusBadgeTxt, { color: statusColor(req.status) }]}>
                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={s.name} numberOfLines={2}>{req.targetUserName}</Text>
          {roleBadge ? (
            <View style={s.roleBadge}>
              <Text style={s.roleBadgeTxt}>{roleBadge}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {req.category === "fee_override_admission" && feeRows.length > 0 && (
        <View style={s.compareBlock} testID={`fee-compare-${req.id}`}>
          <View style={s.compareHeader}>
            <Text style={[s.compareCell, s.compareHead, s.compareHeadFirst]}>Fee head</Text>
            <Text style={[s.compareCell, s.compareHead]}>Default</Text>
            <Text style={[s.compareCell, s.compareHead, s.compareHeadLast]}>Requested</Text>
          </View>
          {feeRows.map((row, idx) => (
            <View
              key={row.key}
              style={[s.compareRow, idx % 2 === 1 && s.compareRowStripe, idx === feeRows.length - 1 && s.compareRowLast]}
            >
              <Text style={[s.compareCell, s.compareKey, s.compareHeadFirst]}>{row.key}</Text>
              <Text style={s.compareCell}>{formatInr(row.defaultVal)}</Text>
              <Text style={[s.compareCell, s.compareCustom, s.compareHeadLast]}>{formatInr(row.customVal)}</Text>
            </View>
          ))}
        </View>
      )}

      {isFinancial && req.category !== "fee_override_admission" && financeLines.length > 0 && (
        <View style={s.financeBlock}>
          {financeLines.map((line) => (
            <Text key={line} style={s.financeLine}>{line}</Text>
          ))}
        </View>
      )}

      <View style={s.metaBlock}>
        {req.reason ? <Text style={s.reason}>{req.reason}</Text> : null}
        <Text style={s.meta}>
          Requested by {req.requestedBy} · {formatDateTime(req.createdAt)}
        </Text>
        {req.decided_by_name ? (
          <Text style={s.meta}>
            {req.status === "approved" ? "Approved" : "Rejected"} by {req.decided_by_name}
            {req.decision_note ? ` · “${req.decision_note}”` : ""}
            {req.decided_at ? ` · ${formatDateTime(req.decided_at)}` : ""}
          </Text>
        ) : null}
      </View>

      {showActions && isPending && (
        <View style={s.actionRow}>
          <TouchableOpacity testID={`appr-approve-${req.id}`} style={s.approveBtn} onPress={onApprove}>
            <Feather name="check" size={15} color="#fff" />
            <Text style={s.approveTxt}>
              {req.category === "user_deactivation" ? "Approve Deactivation" : "Approve"}
            </Text>
          </TouchableOpacity>
          {req.category === "fee_override_admission" && (
            <TouchableOpacity testID={`appr-modify-${req.id}`} style={s.modifyBtn} onPress={onModify}>
              <Feather name="edit-2" size={14} color="#1D4ED8" />
              <Text style={s.modifyTxt}>Modify</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity testID={`appr-reject-${req.id}`} style={s.rejectBtn} onPress={onReject}>
            <Feather name="x" size={14} color={colors.danger} />
            <Text style={s.rejectTxt}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isPending && (
        <View style={s.decisionBar}>
          <View style={[s.decisionBadge, req.status === "approved" ? s.decisionApproved : s.decisionRejected]}>
            <Feather
              name={req.status === "approved" ? "check-circle" : "x-circle"}
              size={14}
              color={req.status === "approved" ? colors.success : colors.danger}
            />
            <Text style={[s.decisionBadgeTxt, { color: req.status === "approved" ? colors.success : colors.danger }]}>
              {req.status === "approved" ? "Approved" : "Rejected"}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function Approvals() {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding, contentMaxWidth, isWide } = useBreakpoint();
  const [reqs, setReqs] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusTab, setStatusTab] = useState<ApprovalStatus>("pending");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ApprovalCategory>("all");
  const [decision, setDecision] = useState<{
    req: ApprovalRequest;
    action: "approve" | "reject" | "modify";
    modifiedFees?: Record<string, string>;
  } | null>(null);
  const [note, setNote] = useState("");
  const [noteFocused, setNoteFocused] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [recentlyResolvedIds, setRecentlyResolvedIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const canView = userHasPermission(user, Permission.APPROVE_REQUESTS);
  const canDecide = userHasPermission(user, Permission.APPROVE_REQUESTS);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (categoryFilter !== "all") params.category = categoryFilter;
      const { data } = await api.get("/approval-requests", { params });
      setReqs(Array.isArray(data) ? data.map(normalizeApprovalRequest) : []);
    } catch (e: any) {
      setError(getApiError(e, "Could not load approval requests."));
      setReqs([]);
    } finally {
      setLoading(false);
    }
  }, [canView, categoryFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = useMemo(() => {
    if (statusTab === "pending") {
      return reqs.filter((r) => r.status === "pending" || recentlyResolvedIds.includes(r.id));
    }
    return reqs.filter((r) => r.status === statusTab);
  }, [reqs, statusTab, recentlyResolvedIds]);

  const pendingCount = useMemo(() => reqs.filter((r) => r.status === "pending").length, [reqs]);

  const closeModal = () => {
    setDecision(null);
    setNote("");
    setNoteFocused(false);
  };

  const markRecentlyResolved = (id: string) => {
    setRecentlyResolvedIds((prev) => [...prev.filter((x) => x !== id), id]);
    setTimeout(() => {
      setRecentlyResolvedIds((prev) => prev.filter((x) => x !== id));
    }, RESOLVED_CARD_TTL_MS);
  };

  const submitDecision = async () => {
    if (!decision || !user) return;

    const { req, action, modifiedFees } = decision;
    const snapshotNote = note.trim();
    const endpointAction = action === "modify" ? "approve" : action;
    const newStatus: ApprovalStatus = action === "reject" ? "rejected" : "approved";

    closeModal();

    const optimistic = normalizeApprovalRequest({
      ...req,
      status: newStatus,
      decided_by_name: user.name,
      decided_at: new Date().toISOString(),
      decision_note: snapshotNote || undefined,
    });

    setSubmittingId(req.id);
    setReqs((prev) => prev.map((r) => (r.id === req.id ? optimistic : r)));
    if (statusTab === "pending") markRecentlyResolved(req.id);

    try {
      const body: Record<string, unknown> = { note: snapshotNote || undefined };
      if (action === "modify" && modifiedFees) {
        const modified_custom_fees: Record<string, number> = {};
        for (const [key, val] of Object.entries(modifiedFees)) {
          const n = parseInt(val, 10);
          if (!Number.isNaN(n) && n >= 0) modified_custom_fees[key] = n;
        }
        body.modified_custom_fees = modified_custom_fees;
      }
      const { data } = await api.post(`/approval-requests/${req.id}/${endpointAction}`, body);
      setReqs((prev) => prev.map((r) => (r.id === req.id ? normalizeApprovalRequest(data) : r)));
    } catch (e: any) {
      setReqs((prev) => prev.map((r) => (r.id === req.id ? req : r)));
      setRecentlyResolvedIds((prev) => prev.filter((id) => id !== req.id));
      Alert.alert("Error", getApiError(e, "Could not save your decision. Please try again."));
    } finally {
      setSubmittingId(null);
    }
  };

  const openModifyDecision = (req: ApprovalRequest) => {
    const rows = feeOverrideRows(req);
    const modifiedFees: Record<string, string> = {};
    rows.forEach((row) => {
      modifiedFees[row.key] = String(row.customVal ?? "");
    });
    setDecision({ req, action: "modify", modifiedFees });
    setNote("");
  };

  const modalTitle = decision?.action === "approve"
    ? "Confirm Request Approval"
    : decision?.action === "modify"
      ? "Modify Fees & Approve"
      : "Confirm Request Rejection";

  const modalConfirmLabel = decision?.action === "modify"
    ? "Confirm Approval"
    : decision?.action === "approve"
      ? "Confirm Approval"
      : "Confirm Rejection";

  if (!user) return null;
  if (!canView) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Approvals</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color={colors.hint} /><Text style={s.emptyTitle}>Not allowed</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="appr-back">
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>APPROVALS</Text>
          <Text style={s.h1}>Workflow Requests</Text>
        </View>
        <View style={[s.pendingPill, pendingCount === 0 && s.pendingPillEmpty]}>
          <Text style={[s.pendingPillTxt, pendingCount === 0 && s.pendingPillTxtEmpty]}>
            {pendingCount} pending
          </Text>
        </View>
      </View>

      <View style={[s.filtersWrap, { paddingHorizontal: horizontalPadding }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
          {APPROVAL_CATEGORY_FILTERS.map((f) => {
            const active = categoryFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                testID={`appr-cat-${f.key}`}
                style={[s.categoryTab, active && s.categoryTabActive]}
                onPress={() => setCategoryFilter(f.key)}
              >
                <Text style={[s.categoryTabTxt, active && s.categoryTabTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.statusRow}>
          {STATUS_TABS.map((t) => (
            <TouchableOpacity
              key={t}
              testID={`appr-tab-${t}`}
              style={[s.statusTab, statusTab === t && s.statusTabActive]}
              onPress={() => setStatusTab(t)}
            >
              <Text style={[s.statusTabTxt, statusTab === t && s.statusTabTxtActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth || 920,
            alignSelf: "center",
            width: "100%",
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading && !refreshing ? (
          <LoadingState message="Loading requests…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title={`No ${statusTab} requests`}
            message={statusTab === "pending" ? "All caught up — no requests awaiting decision." : `No ${statusTab} requests in this filter.`}
          />
        ) : (
          filtered.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              showActions={canDecide && r.status === "pending" && submittingId !== r.id}
              onApprove={() => { setDecision({ req: r, action: "approve" }); setNote(""); }}
              onModify={() => openModifyDecision(r)}
              onReject={() => { setDecision({ req: r, action: "reject" }); setNote(""); }}
            />
          ))
        )}
      </ScrollView>

      <Modal transparent animationType="fade" visible={!!decision} onRequestClose={closeModal}>
        <View style={s.modalBg}>
          <Pressable style={s.modalBackdrop} onPress={closeModal} accessibilityLabel="Close dialog" />
          <View style={[s.modalCard, isWide && s.modalCardWide]}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{modalTitle}</Text>
                <Text style={s.modalSub}>
                  {decision ? `${CATEGORY_LABELS[decision.req.category]} · ${decision.req.targetUserName}` : ""}
                </Text>
              </View>
              <TouchableOpacity onPress={closeModal} style={s.modalCloseBtn} testID="appr-modal-close">
                <Feather name="x" size={20} color={colors.muted2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              {decision?.action === "modify" && decision.modifiedFees && (
                <View style={s.modifyFields}>
                  <Text style={s.fieldLabel}>Adjusted fee amounts</Text>
                  {Object.entries(decision.modifiedFees).map(([key, val]) => (
                    <View key={key} style={s.modifyFieldRow}>
                      <Text style={s.modifyFieldLabel}>{key}</Text>
                      <TextInput
                        value={val}
                        onChangeText={(text) => setDecision((prev) => prev && ({
                          ...prev,
                          modifiedFees: { ...prev.modifiedFees!, [key]: text.replace(/[^0-9]/g, "") },
                        }))}
                        keyboardType="number-pad"
                        style={s.modifyFieldInput}
                        testID={`modify-fee-${key}`}
                      />
                    </View>
                  ))}
                </View>
              )}

              <Text style={s.fieldLabel}>Approval note / remarks (optional)</Text>
              <TextInput
                placeholder="Add context for the requester…"
                placeholderTextColor={colors.hint}
                value={note}
                onChangeText={setNote}
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
                style={[s.input, noteFocused && s.inputFocused]}
                testID="appr-note"
                multiline
                textAlignVertical="top"
              />
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={closeModal} testID="appr-modal-cancel">
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.saveBtn,
                  decision?.action === "reject" && s.saveBtnDanger,
                ]}
                onPress={submitDecision}
                testID="appr-modal-confirm"
              >
                <Text style={s.saveTxt}>{modalConfirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: colors.surface,
  },
  backBtn: { padding: spacing.sm },
  overline: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: colors.hint, textTransform: "uppercase" },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 2 },
  pendingPill: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  pendingPillEmpty: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  pendingPillTxt: { fontSize: 11, fontWeight: "800", color: "#B45309" },
  pendingPillTxtEmpty: { color: "#64748B" },
  filtersWrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  categoryRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    ...Platform.select({ web: { cursor: "pointer", transition: "all 0.15s ease" } as object, default: {} }),
  },
  categoryTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryTabTxt: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  categoryTabTxtActive: { color: "#fff" },
  statusRow: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: radii.md,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignSelf: "flex-start",
  },
  statusTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
    minWidth: 92,
    alignItems: "center",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  statusTabActive: { backgroundColor: colors.surface, ...Platform.select({ web: { boxShadow: "0 1px 2px rgba(15,23,42,0.08)" } as object, default: {} }) },
  statusTabTxt: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  statusTabTxtActive: { color: colors.ink },
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: spacing.lg,
    gap: spacing.md,
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)" } as object,
      default: {},
    }),
  },
  cardApproved: { borderColor: "#BBF7D0", backgroundColor: "#FAFFFB" },
  cardHeader: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  cardHeaderText: { flex: 1, minWidth: 0 },
  statusDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 2 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  categoryTag: { fontSize: 10, fontWeight: "800", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  statusBadgeTxt: { fontSize: 10, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: 6, lineHeight: 22 },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  roleBadgeTxt: { fontSize: 11, fontWeight: "700", color: "#1D4ED8" },
  compareBlock: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    backgroundColor: "#FAFBFC",
  },
  compareHeader: { flexDirection: "row", backgroundColor: "#F1F5F9", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  compareRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EEF2F7" },
  compareRowStripe: { backgroundColor: "#F8FAFC" },
  compareRowLast: { borderBottomWidth: 0 },
  compareCell: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: "#475569" },
  compareHead: { fontWeight: "800", color: "#64748B", textTransform: "uppercase", fontSize: 10, letterSpacing: 0.4 },
  compareHeadFirst: { flex: 1.2 },
  compareHeadLast: { textAlign: "right" },
  compareKey: { fontWeight: "700", color: colors.ink, textTransform: "capitalize" },
  compareCustom: { fontWeight: "800", color: "#B45309", textAlign: "right" },
  financeBlock: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 4,
  },
  financeLine: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
  metaBlock: { gap: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  reason: { fontSize: 13, color: "#64748B", fontStyle: "italic", lineHeight: 18 },
  meta: { fontSize: 12, color: colors.hint, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: spacing.sm, borderTopWidth: 1, borderTopColor: "#EEF2F7", paddingTop: spacing.md },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.success,
    paddingVertical: 11,
    borderRadius: radii.md,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  approveTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  modifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  modifyTxt: { color: "#1D4ED8", fontSize: 13, fontWeight: "800" },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  rejectTxt: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  decisionBar: { borderTopWidth: 1, borderTopColor: "#EEF2F7", paddingTop: spacing.md },
  decisionBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  decisionApproved: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  decisionRejected: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  decisionBadgeTxt: { fontSize: 13, fontWeight: "800" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 8 },
  modalBg: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      web: { boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)" } as object,
      default: {},
    }),
  },
  modalCardWide: { maxWidth: 520 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FAFBFC",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  modalSub: { fontSize: 13, color: colors.muted2, marginTop: 4, lineHeight: 18 },
  modalCloseBtn: {
    padding: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalBody: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, maxHeight: 360 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: radii.md,
    padding: 12,
    fontSize: 14,
    minHeight: 96,
    backgroundColor: colors.surface,
    color: colors.ink,
    lineHeight: 20,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: "#FAFCFF" },
  modifyFields: { marginBottom: spacing.md, gap: 10 },
  modifyFieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  modifyFieldLabel: { width: 120, fontSize: 13, fontWeight: "700", color: colors.ink2, textTransform: "capitalize" },
  modifyFieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FAFBFC",
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: colors.success,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  saveBtnDanger: { backgroundColor: colors.danger },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

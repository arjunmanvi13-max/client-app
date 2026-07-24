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

  return (
    <View style={s.card} testID={`appr-${req.id}`}>
      <View style={s.cardTop}>
        <View style={[s.statusDot, { backgroundColor: statusColor(req.status) }]}>
          <Feather
            name={req.status === "pending" ? "clock" : req.status === "approved" ? "check" : "x"}
            size={13}
            color="#fff"
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.tagRow}>
            <Text style={s.categoryTag}>{CATEGORY_LABELS[req.category]}</Text>
            <View style={[s.statusBadge, { backgroundColor: `${statusColor(req.status)}18` }]}>
              <Text style={[s.statusBadgeTxt, { color: statusColor(req.status) }]}>{req.status}</Text>
            </View>
          </View>
          <Text style={s.name} numberOfLines={1}>{req.targetUserName}</Text>
          {roleBadge ? (
            <View style={s.roleBadge}>
              <Text style={s.roleBadgeTxt}>{roleBadge}</Text>
            </View>
          ) : null}
          {req.category === "fee_override_admission" && feeRows.length > 0 && (
            <View style={s.compareBlock} testID={`fee-compare-${req.id}`}>
              <View style={s.compareHeader}>
                <Text style={[s.compareCell, s.compareHead]}>Fee head</Text>
                <Text style={[s.compareCell, s.compareHead]}>Default</Text>
                <Text style={[s.compareCell, s.compareHead]}>Requested</Text>
              </View>
              {feeRows.map((row) => (
                <View key={row.key} style={s.compareRow}>
                  <Text style={[s.compareCell, s.compareKey]}>{row.key}</Text>
                  <Text style={s.compareCell}>{formatInr(row.defaultVal)}</Text>
                  <Text style={[s.compareCell, s.compareCustom]}>{formatInr(row.customVal)}</Text>
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
          {req.reason ? <Text style={s.reason}>Reason: {req.reason}</Text> : null}
          <Text style={s.meta}>
            Requested by {req.requestedBy} · {formatDateTime(req.createdAt)}
          </Text>
          {req.decided_by_name ? (
            <Text style={s.meta}>
              {req.status} by {req.decided_by_name}
              {req.decision_note ? ` · “${req.decision_note}”` : ""}
            </Text>
          ) : null}
        </View>
      </View>

      {showActions && (
        <View style={s.actionRow}>
          <TouchableOpacity testID={`appr-approve-${req.id}`} style={s.approveBtn} onPress={onApprove}>
            <Feather name="check" size={14} color="#fff" />
            <Text style={s.approveTxt}>
              {req.category === "user_deactivation" ? "Approve Deactivation" : "Approve"}
            </Text>
          </TouchableOpacity>
          {req.category === "fee_override_admission" && (
            <TouchableOpacity testID={`appr-modify-${req.id}`} style={s.modifyBtn} onPress={onModify}>
              <Feather name="edit-2" size={14} color="#1E40AF" />
              <Text style={s.modifyTxt}>Modify</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity testID={`appr-reject-${req.id}`} style={s.rejectBtn} onPress={onReject}>
            <Feather name="x" size={14} color={colors.danger} />
            <Text style={s.rejectTxt}>Reject</Text>
          </TouchableOpacity>
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
  const [busy, setBusy] = useState(false);
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

  const filtered = useMemo(
    () => reqs.filter((r) => r.status === statusTab),
    [reqs, statusTab],
  );

  const pendingCount = useMemo(() => reqs.filter((r) => r.status === "pending").length, [reqs]);

  if (!user) return null;
  if (!canView) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Approvals</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color={colors.hint} /><Text style={s.emptyTitle}>Not allowed</Text></View>
      </SafeAreaView>
    );
  }

  const submitDecision = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { note: note || undefined };
      if (decision.action === "modify" && decision.modifiedFees) {
        const modified_custom_fees: Record<string, number> = {};
        for (const [key, val] of Object.entries(decision.modifiedFees)) {
          const n = parseInt(val, 10);
          if (!Number.isNaN(n) && n >= 0) modified_custom_fees[key] = n;
        }
        body.modified_custom_fees = modified_custom_fees;
      }
      const endpointAction = decision.action === "modify" ? "approve" : decision.action;
      await api.post(`/approval-requests/${decision.req.id}/${endpointAction}`, body);
      setDecision(null);
      setNote("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
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
        {pendingCount > 0 && (
          <View style={s.pendingPill}>
            <Text style={s.pendingPillTxt}>{pendingCount} pending</Text>
          </View>
        )}
      </View>

      <View style={[s.filtersWrap, { paddingHorizontal: horizontalPadding }]}>
        <View style={[s.categoryRow, isWide && s.categoryRowWide]}>
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
        </View>

        <View style={s.statusRow}>
          {STATUS_TABS.map((t) => (
            <TouchableOpacity
              key={t}
              testID={`appr-tab-${t}`}
              style={[s.statusTab, statusTab === t && s.statusTabActive]}
              onPress={() => setStatusTab(t)}
            >
              <Text style={[s.statusTabTxt, statusTab === t && s.statusTabTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth,
            alignSelf: contentMaxWidth ? "center" : undefined,
            width: contentMaxWidth ? "100%" : undefined,
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
              showActions={statusTab === "pending" && canDecide}
              onApprove={() => { setDecision({ req: r, action: "approve" }); setNote(""); }}
              onModify={() => openModifyDecision(r)}
              onReject={() => { setDecision({ req: r, action: "reject" }); setNote(""); }}
            />
          ))
        )}
      </ScrollView>

      <Modal transparent animationType="slide" visible={!!decision} onRequestClose={() => setDecision(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {decision?.action === "approve"
                ? "Approve request"
                : decision?.action === "modify"
                  ? "Modify fees & approve"
                  : "Reject request"}
            </Text>
            <Text style={s.modalSub}>
              {decision ? CATEGORY_LABELS[decision.req.category] : ""} · {decision?.req.targetUserName}
            </Text>
            {decision?.action === "modify" && decision.modifiedFees && (
              <View style={s.modifyFields}>
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
            <TextInput
              placeholder="Optional note"
              placeholderTextColor={colors.hint}
              value={note}
              onChangeText={setNote}
              style={s.input}
              testID="appr-note"
              multiline
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setDecision(null)} testID="appr-modal-cancel">
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, busy && { opacity: 0.6 }, decision?.action === "reject" && { backgroundColor: colors.danger }]}
                disabled={busy}
                onPress={submitDecision}
                testID="appr-modal-confirm"
              >
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={s.saveTxt}>
                    Confirm {decision?.action === "modify" ? "modify & approve" : decision?.action}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.sm },
  overline: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: colors.hint, textTransform: "uppercase" },
  h1: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 2 },
  pendingPill: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  pendingPillTxt: { fontSize: 11, fontWeight: "800", color: "#B45309" },
  filtersWrap: { paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  categoryRowWide: { flexWrap: "nowrap" },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  categoryTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryTabTxt: { fontSize: 12, fontWeight: "700", color: colors.muted2 },
  categoryTabTxtActive: { color: "#fff" },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radii.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  statusTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.sm,
    minWidth: 88,
    alignItems: "center",
  },
  statusTabActive: { backgroundColor: colors.ink },
  statusTabTxt: { fontSize: 12, fontWeight: "700", color: colors.muted2, textTransform: "capitalize" },
  statusTabTxtActive: { color: "#fff" },
  scroll: { paddingTop: spacing.sm, paddingBottom: spacing.xl * 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...Platform.select({
      web: { boxShadow: "0 1px 6px rgba(15, 23, 42, 0.05)" } as object,
      default: {},
    }),
  },
  cardTop: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  statusDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 2 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  categoryTag: { fontSize: 10, fontWeight: "800", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  statusBadgeTxt: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  name: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 4 },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  roleBadgeTxt: { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  financeBlock: {
    marginTop: 8,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 2,
  },
  financeLine: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  compareBlock: {
    marginTop: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: "hidden",
  },
  compareHeader: { flexDirection: "row", backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  compareRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  compareCell: { flex: 1, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: colors.ink2 },
  compareHead: { fontWeight: "800", color: colors.muted2, textTransform: "uppercase", fontSize: 10 },
  compareKey: { fontWeight: "700", color: colors.ink },
  compareCustom: { fontWeight: "700", color: "#B45309" },
  reason: { fontSize: 12, color: colors.ink2, marginTop: 6, fontStyle: "italic" },
  meta: { fontSize: 11, color: colors.hint, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.success,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  approveTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  modifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  modifyTxt: { color: "#1E40AF", fontSize: 12, fontWeight: "800" },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  rejectTxt: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  modalCard: { padding: 20, paddingBottom: 28, backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  modalSub: { fontSize: 12, color: colors.muted2, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12, marginTop: 12, fontSize: 14, minHeight: 60, backgroundColor: colors.surface },
  modifyFields: { marginTop: 12, gap: 8 },
  modifyFieldRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modifyFieldLabel: { width: 120, fontSize: 12, fontWeight: "700", color: colors.ink2 },
  modifyFieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: colors.surface,
  },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.md, backgroundColor: colors.surface2, alignItems: "center" },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: colors.muted },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.md, backgroundColor: colors.success, alignItems: "center" },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

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

function RequestCard({
  req,
  showActions,
  onApprove,
  onReject,
}: {
  req: ApprovalRequest;
  showActions: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const roleBadge = roleBadgeLabel(req);
  const financeLines = financialSummary(req);
  const isFinancial = req.category !== "user_deactivation";

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
          {isFinancial && financeLines.length > 0 && (
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
            <Text style={s.approveTxt}>Approve{req.category === "user_deactivation" ? " Deactivation" : ""}</Text>
          </TouchableOpacity>
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
  const [decision, setDecision] = useState<{ req: ApprovalRequest; action: "approve" | "reject" } | null>(null);
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
      await api.post(`/approval-requests/${decision.req.id}/${decision.action}`, { note: note || undefined });
      setDecision(null);
      setNote("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
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
              onReject={() => { setDecision({ req: r, action: "reject" }); setNote(""); }}
            />
          ))
        )}
      </ScrollView>

      <Modal transparent animationType="slide" visible={!!decision} onRequestClose={() => setDecision(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{decision?.action === "approve" ? "Approve request" : "Reject request"}</Text>
            <Text style={s.modalSub}>
              {decision ? CATEGORY_LABELS[decision.req.category] : ""} · {decision?.req.targetUserName}
            </Text>
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
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Confirm {decision?.action}</Text>}
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
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.md, backgroundColor: colors.surface2, alignItems: "center" },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: colors.muted },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: radii.md, backgroundColor: colors.success, alignItems: "center" },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});

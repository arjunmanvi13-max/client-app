import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth, userHasPermission } from "../auth";
import { BusinessEntity, Permission, isSuperAdminUser } from "../rbac";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../ScreenStates";
import { useBreakpoint } from "../useBreakpoint";
import { formatDate, formatDateTime } from "../dateFormat";
import { colors, formColors, radii, spacing } from "../theme";
import {
  createExpenseEntry, deleteExpenseEntry, fetchExpenseEntries,
  resubmitExpenseEntry, recallExpenseEntry, updateExpenseEntry,
} from "./expenseApi";
import { ExpenseEntryFormModal, type ExpenseEntryFormPayload } from "./ExpenseEntryFormModal";
import { ExpenseItemsBreakdown } from "./ExpenseItemsBreakdown";
import { expenseItemsSummary, getExpenseLineItems } from "./expenseItemUtils";
import { formatInr } from "./expenseFormat";
import type { ExpenseEntityId, ExpenseEntry, ExpenseTab } from "./expenseTypes";

const TABS: { key: ExpenseTab; label: string }[] = [
  { key: "all", label: "All Entries" },
  { key: "pending", label: "Pending Approval" },
  { key: "approved", label: "Approved / Finalised" },
  { key: "rejected", label: "Rejected" },
];

function statusStyle(status: string) {
  if (status === "pending") return { bg: colors.warningSoft, color: "#D97706", label: "Pending" };
  if (status === "approved") return { bg: colors.successSoft, color: colors.success, label: "Approved" };
  if (status === "rejected") return { bg: "#FED7AA", color: "#9A3412", label: "Rejected" };
  return { bg: colors.borderSoft, color: colors.muted2, label: status };
}

type Props = {
  entityId: ExpenseEntityId;
  title: string;
  overline: string;
};

export function ExpenseLedgerScreen({ entityId, title, overline }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const perm = entityId === "pws" ? Permission.CAPTURE_PWS_EXPENSES : Permission.CAPTURE_ALPHA_EXPENSES;
  const entity = entityId === "pws" ? BusinessEntity.PWS : BusinessEntity.ALPHA;
  const canCapture = userHasPermission(user, perm, entity) || isSuperAdminUser(user);
  const role = (user?.role || "").toLowerCase();
  const canView = canCapture || isSuperAdminUser(user)
    || (entityId === "pws" && ["principal", "vice_principal", "pws_admin", "pws_accounts"].includes(role))
    || (entityId === "alpha" && ["admin", "alpha_admin", "alpha_accounts"].includes(role));

  const [tab, setTab] = useState<ExpenseTab>("all");
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseEntry | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setEntries(await fetchExpenseEntries(entityId, tab));
    } catch (err: unknown) {
      setError(getApiError(err, "Could not load expenses."));
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [entityId, tab]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (entry: ExpenseEntry) => {
    if (entry.status !== "pending" && entry.status !== "rejected") return;
    setEditing(entry);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: ExpenseEntryFormPayload) => {
    if (!canCapture) return;
    setSaving(true);
    try {
      if (payload.entity_id !== entityId && !editing) {
        Alert.alert(
          "Saved to " + payload.entity_id.toUpperCase(),
          `This expense was submitted under ${payload.entity_id.toUpperCase()}. View it on the ${payload.entity_id.toUpperCase()} Expenses page.`,
        );
      }
      if (editing) {
        await updateExpenseEntry(editing.id, payload);
      } else {
        await createExpenseEntry(payload);
      }
      setModalOpen(false);
      setEditing(null);
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
        <View style={s.empty}><Feather name="lock" size={40} color={colors.hint} /><Text style={s.emptyTitle}>Expense access required</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Feather name="chevron-left" size={22} color={colors.ink} />
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

      <View style={[s.filtersWrap, { paddingHorizontal: horizontalPadding }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t.key)}>
                <Text style={[s.tabTxt, active && s.tabTxtActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
        {loading && entries.length === 0 && <LoadingState message="Loading expenses…" />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && entries.length === 0 && (
          <EmptyState
            title="No expense entries"
            subtitle={
              tab === "rejected"
                ? "Rejected expenses appear here with approver comments. Edit and resubmit when ready."
                : tab === "pending"
                  ? "Submitted expenses awaiting approval will appear here."
                  : "Add a new expense to get started."
            }
          />
        )}
        {!loading && !error && entries.map((entry) => {
          const st = statusStyle(entry.status);
          const editable = entry.status === "pending" || entry.status === "rejected";
          const summaryLabel = expenseItemsSummary(entry);
          return (
            <View key={entry.id} style={s.card}>
              <View style={s.cardHeader}>
                <View style={[s.statusDot, { backgroundColor: st.color }]}>
                  <Feather name={entry.status === "approved" ? "check" : entry.status === "rejected" ? "x" : "clock"} size={14} color="#fff" />
                </View>
                <View style={s.cardHeaderText}>
                  <View style={s.tagRow}>
                    <Text style={s.categoryTag}>{entry.category_code || entry.entity_id.toUpperCase()}</Text>
                    <View style={[s.statusBadge, { backgroundColor: `${st.color}14` }]}>
                      <Text style={[s.statusBadgeTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={s.cardTitle}>{entry.expense_head_name || entry.main_category || "Expense"}</Text>
                  <Text style={s.cardMeta}>{entry.request_id} · {formatDate(entry.expense_date)}{entry.urgency ? ` · ${entry.urgency}` : ""}</Text>
                  <Text style={s.cardSub}>{summaryLabel}</Text>
                </View>
                <Text style={s.amount}>{formatInr(entry.amount)}</Text>
              </View>
              <ExpenseItemsBreakdown entry={entry} compact={getExpenseLineItems(entry).length <= 1} />
              <Text style={s.cardSub}>{entry.payment_mode}{entry.reference_number ? ` · Ref ${entry.reference_number}` : ""}</Text>
              {entry.budget_alert?.over_budget && (
                <View style={[s.inlineBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[s.inlineBadgeTxt, { color: "#B45309" }]}>Over Budget</Text>
                </View>
              )}
              {entry.status === "rejected" && entry.rejection_reason ? (
                <View style={s.rejectBox}>
                  <Text style={s.rejectBoxTitle}>Action required — rejected by approver</Text>
                  <Text style={s.rejectBoxReason}>{entry.rejection_reason}</Text>
                  <Text style={s.rejectBoxMeta}>
                    {entry.rejected_by_name ? `${entry.rejected_by_name}` : "Approver"}
                    {entry.rejected_at ? ` · ${formatDateTime(entry.rejected_at)}` : ""}
                  </Text>
                </View>
              ) : null}
              <View style={s.actions}>
                {editable && canCapture && (
                  <>
                    <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(entry)}>
                      <Text style={s.actionTxt}>Edit{entry.status === "rejected" ? " & Resubmit" : ""}</Text>
                    </TouchableOpacity>
                    {entry.status === "pending" && (
                      <TouchableOpacity style={[s.actionBtn, s.actionDanger]} onPress={() => handleDelete(entry)}>
                        <Text style={[s.actionTxt, { color: colors.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
                    {entry.status === "rejected" && (
                      <TouchableOpacity style={s.actionBtn} onPress={() => handleResubmit(entry)}>
                        <Text style={s.actionTxt}>Resubmit</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
                {entry.status === "approved" && isSuperAdminUser(user) && (
                  <TouchableOpacity style={[s.actionBtn, s.actionDanger]} onPress={() => handleRecall(entry)}>
                    <Text style={[s.actionTxt, { color: colors.danger }]}>Recall</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <ExpenseEntryFormModal
        visible={modalOpen}
        defaultEntity={entityId}
        lockedEntity={entityId}
        editing={editing}
        saving={saving}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  backBtn: { padding: 4 },
  overline: { fontSize: 10, fontWeight: "800", color: colors.muted2, letterSpacing: 0.8 },
  h1: { fontSize: 20, fontWeight: "800", color: colors.ink },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: formColors.primary,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm,
  },
  addBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  filtersWrap: {
    paddingTop: spacing.md, paddingBottom: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tabRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: 2 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabTxt: { fontSize: 12, fontWeight: "700", color: colors.muted2 },
  tabTxtActive: { color: "#fff" },
  scroll: { paddingTop: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.sm,
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)" } as object,
      default: {},
    }),
  },
  cardHeader: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  cardHeaderText: { flex: 1, minWidth: 0 },
  statusDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 2 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  categoryTag: { fontSize: 10, fontWeight: "800", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  statusBadgeTxt: { fontSize: 10, fontWeight: "800" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 6, lineHeight: 21 },
  cardMeta: { fontSize: 11, color: colors.muted2, marginTop: 4 },
  amount: { fontSize: 16, fontWeight: "800", color: colors.ink },
  cardSub: { fontSize: 11, color: colors.muted2 },
  inlineBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  inlineBadgeTxt: { fontSize: 10, fontWeight: "800" },
  rejectBox: {
    marginTop: spacing.sm, padding: spacing.sm, borderRadius: radii.sm,
    backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: "#FECACA",
  },
  rejectBoxTitle: { fontSize: 11, fontWeight: "800", color: colors.danger },
  rejectBoxReason: { fontSize: 12, color: "#7F1D1D", marginTop: 4, lineHeight: 17 },
  rejectBoxMeta: { fontSize: 10, color: colors.muted2, marginTop: 4 },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm, backgroundColor: colors.borderSoft },
  actionDanger: { backgroundColor: colors.dangerSoft },
  actionTxt: { fontSize: 11, fontWeight: "700", color: colors.primary },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
});

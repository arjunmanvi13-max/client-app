import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../../src/auth";
import { isSuperAdminUser } from "../../../src/rbac";
import { LoadingState, EmptyState, ErrorState, FormLabel, getApiError } from "../../../src/ScreenStates";
import { useBreakpoint } from "../../../src/useBreakpoint";
import {
  createExpenseHead, fetchExpenseHeads, toggleExpenseHead, updateExpenseHead,
} from "../../../src/expenses/expenseApi";
import { formatInr } from "../../../src/expenses/expenseFormat";
import type { ExpenseEntityId, ExpenseHead } from "../../../src/expenses/expenseTypes";
import { EXPENSE_MAIN_CATEGORIES } from "../../../src/expenses/expenseTypes";

function normalizeEntityId(value?: string | null, fallbackCode?: string): ExpenseEntityId {
  const normalized = (value || "").toLowerCase();
  if (normalized === "alpha" || normalized === "pws") return normalized;
  const upper = (fallbackCode || "").toUpperCase();
  if (upper.startsWith("ALPHA-")) return "alpha";
  if (upper.startsWith("PWS-")) return "pws";
  return "pws";
}

function entityPrefix(entity: ExpenseEntityId): string {
  return `${entity.toUpperCase()}-`;
}

export default function ExpenseStructurePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding } = useBreakpoint();
  const [entity, setEntity] = useState<ExpenseEntityId>("pws");
  const [heads, setHeads] = useState<ExpenseHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseHead | null>(null);
  const [modalEntity, setModalEntity] = useState<ExpenseEntityId>("pws");
  const [mainCategory, setMainCategory] = useState(EXPENSE_MAIN_CATEGORIES[0]);
  const [subCategory, setSubCategory] = useState("");
  const [code, setCode] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  const allowed = isSuperAdminUser(user);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchExpenseHeads(entity, false);
      setHeads(rows);
    } catch (err: unknown) {
      setError(getApiError(err, "Could not load expense structure."));
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useFocusEffect(useCallback(() => { if (allowed) load(); }, [load, allowed]));

  useEffect(() => {
    if (allowed) load();
  }, [entity, allowed, load]);

  const rewriteCodePrefix = (value: string, from: ExpenseEntityId, to: ExpenseEntityId) => {
    const fromPrefix = `${from.toUpperCase()}-`;
    const toPrefix = `${to.toUpperCase()}-`;
    if (value.toUpperCase().startsWith(fromPrefix)) {
      return toPrefix + value.slice(fromPrefix.length);
    }
    return value;
  };

  const openCreate = () => {
    setEditing(null);
    setModalEntity(entity);
    setMainCategory(EXPENSE_MAIN_CATEGORIES[0]);
    setSubCategory("");
    setCode("");
    setBudget("");
    setModalOpen(true);
  };

  const openEdit = (head: ExpenseHead) => {
    setEditing(head);
    setModalEntity(normalizeEntityId(head.entity_id, head.category_code));
    setMainCategory(head.main_category as typeof EXPENSE_MAIN_CATEGORIES[number]);
    setSubCategory(head.sub_category);
    setCode(head.category_code);
    setBudget(head.monthly_budget_limit ? String(head.monthly_budget_limit) : "");
    setModalOpen(true);
  };

  const onCodeChange = (value: string) => {
    setCode(value);
    const upper = value.toUpperCase();
    if (upper.startsWith("ALPHA-")) setModalEntity("alpha");
    else if (upper.startsWith("PWS-")) setModalEntity("pws");
  };

  const onModalEntityChange = (next: ExpenseEntityId) => {
    if (next === modalEntity) return;
    if (code.trim()) {
      setCode(rewriteCodePrefix(code.trim(), modalEntity, next));
    }
    setModalEntity(next);
  };

  const refreshHeadsForEntity = async (targetEntity: ExpenseEntityId) => {
    setEntity(targetEntity);
    setLoading(true);
    setError("");
    try {
      setHeads(await fetchExpenseHeads(targetEntity, false));
    } catch (err: unknown) {
      setError(getApiError(err, "Could not load expense structure."));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!subCategory.trim()) {
      Alert.alert("Required", "Sub-category / expense head name is required.");
      return;
    }
    const trimmedCode = code.trim();
    if (trimmedCode && !trimmedCode.toUpperCase().startsWith(entityPrefix(modalEntity))) {
      Alert.alert(
        "Entity mismatch",
        `Category code must start with ${entityPrefix(modalEntity)} for ${modalEntity.toUpperCase()}.`,
      );
      return;
    }
    if (budget.trim()) {
      const budgetNum = parseInt(budget.replace(/,/g, ""), 10);
      if (Number.isNaN(budgetNum)) {
        Alert.alert("Invalid budget", "Monthly budget must be a valid number.");
        return;
      }
    }
    setSaving(true);
    try {
      const budgetNum = budget.trim() ? parseInt(budget.replace(/,/g, ""), 10) : undefined;
      const savedEntity = modalEntity;
      if (editing) {
        await updateExpenseHead(editing.id, {
          entity_id: savedEntity,
          category_code: trimmedCode || undefined,
          main_category: mainCategory,
          sub_category: subCategory.trim(),
          monthly_budget_limit: budgetNum,
        });
      } else {
        await createExpenseHead({
          entity_id: savedEntity,
          category_code: trimmedCode || undefined,
          main_category: mainCategory,
          sub_category: subCategory.trim(),
          monthly_budget_limit: budgetNum,
          status: "active",
        });
      }
      setModalOpen(false);
      setEditing(null);
      await refreshHeadsForEntity(savedEntity);
    } catch (err: unknown) {
      Alert.alert("Save failed", getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>Super Admin only</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>SYSTEM & SETTINGS</Text>
          <Text style={s.h1}>Expense Structure</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openCreate}><Feather name="plus" size={14} color="#fff" /><Text style={s.addBtnTxt}>Add Head</Text></TouchableOpacity>
      </View>

      <View style={[s.entityRow, { paddingHorizontal: horizontalPadding }]}>
        {(["pws", "alpha"] as ExpenseEntityId[]).map((e) => (
          <TouchableOpacity key={e} style={[s.entityChip, entity === e && s.entityChipActive]} onPress={() => setEntity(e)}>
            <Text style={[s.entityChipTxt, entity === e && s.entityChipTxtActive]}>{e.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {loading && heads.length === 0 && <LoadingState message="Loading expense heads…" />}
        {error ? <ErrorState message={error} onRetry={load} /> : null}
        {!loading && !error && heads.length === 0 && <EmptyState title="No expense heads" subtitle="Add your first expense head for this entity." />}
        {heads.map((head) => (
          <View key={head.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.code}>{head.category_code}</Text>
                <Text style={s.cardTitle}>{head.sub_category}</Text>
                <Text style={s.cardMeta}>{head.main_category}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View style={[s.badge, head.status === "active" ? s.badgeActive : s.badgeInactive]}>
                  <Text style={[s.badgeTxt, head.status === "active" ? s.badgeTxtActive : s.badgeTxtInactive]}>{head.status === "active" ? "Active" : "Inactive"}</Text>
                </View>
                {head.monthly_budget_limit ? <Text style={s.budget}>Budget: {formatInr(head.monthly_budget_limit, 0)}/mo</Text> : null}
              </View>
            </View>
            <View style={s.actions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(head)}><Text style={s.actionTxt}>Edit</Text></TouchableOpacity>
              <TouchableOpacity style={s.actionBtn} onPress={async () => { await toggleExpenseHead(head.id); await load(); }}>
                <Text style={s.actionTxt}>{head.status === "active" ? "Deactivate" : "Activate"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>{editing ? "Edit Expense Head" : "Add Expense Head"}</Text>
            <FormLabel label="Entity" />
            <View style={s.entityRow}>
              {(["pws", "alpha"] as ExpenseEntityId[]).map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[s.entityChip, modalEntity === e && s.entityChipActive]}
                  onPress={() => onModalEntityChange(e)}
                >
                  <Text style={[s.entityChipTxt, modalEntity === e && s.entityChipTxtActive]}>{e.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <FormLabel label={editing ? "Category Code" : "Category Code (optional — auto-generated if blank)"} />
            <TextInput
              style={s.input}
              value={code}
              onChangeText={onCodeChange}
              placeholder={modalEntity === "pws" ? "PWS-OPS-001" : "ALPHA-OPS-001"}
              autoCapitalize="characters"
            />
            <FormLabel label="Main Category" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {EXPENSE_MAIN_CATEGORIES.map((c) => (
                <TouchableOpacity key={c} style={[s.chip, mainCategory === c && s.chipActive]} onPress={() => setMainCategory(c)}>
                  <Text style={[s.chipTxt, mainCategory === c && s.chipTxtActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <FormLabel label="Sub-Category / Expense Head Name" />
            <TextInput style={s.input} value={subCategory} onChangeText={setSubCategory} placeholder="e.g. Cricket Gear" />
            <FormLabel label="Monthly Budget Limit (₹) — optional" />
            <TextInput style={s.input} value={budget} onChangeText={setBudget} keyboardType="numeric" placeholder="e.g. 50000" />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalOpen(false)}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}><Text style={s.saveTxt}>{saving ? "Saving…" : "Save"}</Text></TouchableOpacity>
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
  entityRow: { flexDirection: "row", gap: 8, paddingVertical: 10 },
  entityChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#E2E8F0" },
  entityChipActive: { backgroundColor: "#1E40AF" },
  entityChipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  entityChipTxtActive: { color: "#fff" },
  scroll: { paddingBottom: 24 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTop: { flexDirection: "row", gap: 12 },
  code: { fontSize: 10, fontWeight: "700", color: "#94A3B8" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  cardMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeActive: { backgroundColor: "#DCFCE7" },
  badgeInactive: { backgroundColor: "#F1F5F9" },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
  badgeTxtActive: { color: "#16A34A" },
  badgeTxtInactive: { color: "#64748B" },
  budget: { fontSize: 10, color: "#64748B", fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#F1F5F9" },
  actionTxt: { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, maxWidth: 520, width: "100%", alignSelf: "center" },
  modalTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12, color: "#0F172A" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10, fontSize: 13 },
  readonly: { fontSize: 13, fontWeight: "700", color: "#64748B", marginBottom: 10 },
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

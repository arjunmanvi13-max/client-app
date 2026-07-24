import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { Permission, isSuperAdminUser } from "../../../src/rbac";
import { LoadingState, EmptyState, ErrorState, FormLabel, InlineFieldError, getApiError } from "../../../src/ScreenStates";
import { useBreakpoint } from "../../../src/useBreakpoint";

type Tab = "catalogue" | "plans";

type CatalogueItem = {
  id: string;
  entity_id: string;
  code: string;
  name: string;
  fee_type: string;
  amount: number;
  billing_frequency: string;
  active: boolean;
  legacy_fee_type?: string;
};

const FEE_TYPES = ["tuition", "transport", "hostel", "examination", "coaching", "registration", "uniform", "kit", "tournament"];
const FREQUENCIES = ["monthly", "quarterly", "term_wise", "annual", "one_time"];

export default function FeeCatalogAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [tab, setTab] = useState<Tab>("catalogue");
  const [entity, setEntity] = useState<"pws" | "alpha">("pws");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formErr, setFormErr] = useState("");
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [feeType, setFeeType] = useState("tuition");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const [editItem, setEditItem] = useState<CatalogueItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editFeeType, setEditFeeType] = useState("tuition");
  const [editAmount, setEditAmount] = useState("");
  const [editFrequency, setEditFrequency] = useState("monthly");
  const [editActive, setEditActive] = useState(true);
  const [editErr, setEditErr] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);

  const canManage = userHasPermission(user, Permission.MANAGE_FEES_HEADS);
  const canEditCatalogue = isSuperAdminUser(user);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [iRes, pRes] = await Promise.all([
        api.get("/fee-catalog/items", { params: { entity_id: entity, active: true } }),
        api.get("/fee-catalog/plans", { params: { entity_id: entity, active: true } }),
      ]);
      setItems(iRes.data);
      setPlans(pRes.data);
    } catch (e: any) {
      setError(getApiError(e, "Could not load fee catalogue."));
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createItem = async () => {
    if (!canManage) return;
    const missing: string[] = [];
    if (!name.trim()) missing.push("name");
    if (!code.trim()) missing.push("code");
    if (!amount.trim() || isNaN(parseFloat(amount))) missing.push("amount");
    if (missing.length) {
      setFormErr(`Please enter ${missing.join(", ")}.`);
      return;
    }
    setFormErr("");
    try {
      await api.post("/fee-catalog/items", {
        entity_id: entity,
        code: code.trim(),
        name: name.trim(),
        fee_type: feeType,
        amount: parseFloat(amount),
        billing_frequency: frequency,
        active: true,
      });
      setName("");
      setCode("");
      setAmount("");
      await load();
      showToast("Catalogue item created successfully.");
    } catch (e: any) {
      setFormErr(getApiError(e, "Could not create catalogue item."));
    }
  };

  const openEdit = (item: CatalogueItem) => {
    if (!canEditCatalogue) return;
    setEditItem(item);
    setEditName(item.name);
    setEditFeeType(item.fee_type);
    setEditAmount(String(item.amount));
    setEditFrequency(item.billing_frequency);
    setEditActive(item.active !== false);
    setEditErr("");
  };

  const closeEdit = () => {
    if (editSaving || editDeleting) return;
    setEditItem(null);
    setEditErr("");
  };

  const saveEdit = async () => {
    if (!editItem || !canEditCatalogue) return;
    const missing: string[] = [];
    if (!editName.trim()) missing.push("name");
    if (!editAmount.trim() || isNaN(parseFloat(editAmount))) missing.push("amount");
    if (missing.length) {
      setEditErr(`Please enter ${missing.join(", ")}.`);
      return;
    }
    setEditSaving(true);
    setEditErr("");
    try {
      await api.patch(`/fee-catalog/items/${editItem.id}`, {
        name: editName.trim(),
        fee_type: editFeeType,
        amount: parseFloat(editAmount),
        billing_frequency: editFrequency,
        active: editActive,
      });
      setEditItem(null);
      await load();
      showToast("Catalogue item updated successfully.");
    } catch (e: any) {
      setEditErr(getApiError(e, "Could not update catalogue item."));
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!editItem || !canEditCatalogue) return;
    const itemName = editItem.name;
    Alert.alert(
      "Delete catalogue item",
      `Are you sure you want to delete "${itemName}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteItem(itemName) },
      ],
    );
  };

  const deleteItem = async (itemName: string) => {
    if (!editItem) return;
    setEditDeleting(true);
    setEditErr("");
    try {
      await api.delete(`/fee-catalog/items/${editItem.id}`);
      setEditItem(null);
      await load();
      showToast(`"${itemName}" deleted successfully.`);
    } catch (e: any) {
      setEditErr(getApiError(e, "Could not delete catalogue item."));
    } finally {
      setEditDeleting(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>FINANCE</Text>
          <Text style={s.h1}>Fee Catalogue & Plans</Text>
        </View>
      </View>

      {toastMessage ? (
        <View style={s.toastBanner} testID="fee-catalog-toast">
          <Feather name="check-circle" size={16} color="#059669" />
          <Text style={s.toastTxt}>{toastMessage}</Text>
        </View>
      ) : null}

      <View style={s.entityRow}>
        {(["pws", "alpha"] as const).map((e) => (
          <TouchableOpacity key={e} style={[s.chip, entity === e && s.chipOn]} onPress={() => setEntity(e)}>
            <Text style={[s.chipTxt, entity === e && s.chipTxtOn]}>{e.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "catalogue" && s.tabOn]} onPress={() => setTab("catalogue")}>
          <Text style={[s.tabTxt, tab === "catalogue" && s.tabTxtOn]}>Catalogue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "plans" && s.tabOn]} onPress={() => setTab("plans")}>
          <Text style={[s.tabTxt, tab === "plans" && s.tabTxtOn]}>Plans</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <LoadingState message="Loading fee catalogue…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
          {tab === "catalogue" && (
            <>
              {canManage && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>New catalogue item</Text>
                  <FormLabel required>Name</FormLabel>
                  <TextInput style={[s.input, !name.trim() && formErr ? s.inputErr : null]} placeholder="Tuition fee" value={name} onChangeText={setName} />
                  <FormLabel required>Code</FormLabel>
                  <TextInput style={[s.input, !code.trim() && formErr ? s.inputErr : null]} placeholder="Code (unique)" value={code} onChangeText={setCode} autoCapitalize="none" />
                  <FormLabel required>Amount</FormLabel>
                  <TextInput style={[s.input, (!amount.trim() || isNaN(parseFloat(amount))) && formErr ? s.inputErr : null]} placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                    {FEE_TYPES.map((ft) => (
                      <TouchableOpacity key={ft} style={[s.chip, feeType === ft && s.chipOn]} onPress={() => setFeeType(ft)}>
                        <Text style={[s.chipTxt, feeType === ft && s.chipTxtOn]}>{ft}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {FREQUENCIES.map((f) => (
                      <TouchableOpacity key={f} style={[s.chip, frequency === f && s.chipOn]} onPress={() => setFrequency(f)}>
                        <Text style={[s.chipTxt, frequency === f && s.chipTxtOn]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {formErr ? <Text style={s.formErr}>{formErr}</Text> : null}
                  <TouchableOpacity style={s.primaryBtn} onPress={createItem}>
                    <Text style={s.primaryBtnTxt}>Add item</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={s.section}>Active catalogue ({items.length})</Text>
              {canEditCatalogue ? (
                <Text style={s.hint}>Tap an item to edit or delete.</Text>
              ) : null}
              {items.length === 0 ? (
                <EmptyState icon="inbox" title="No catalogue items" message={`Add fee items for ${entity.toUpperCase()} to get started.`} />
              ) : items.map((item) => {
                const RowWrap = canEditCatalogue ? TouchableOpacity : View;
                return (
                  <RowWrap
                    key={item.id}
                    style={[s.listRow, canEditCatalogue && s.listRowClickable]}
                    onPress={canEditCatalogue ? () => openEdit(item) : undefined}
                    testID={`catalogue-item-${item.id}`}
                    accessibilityRole={canEditCatalogue ? "button" : undefined}
                    accessibilityLabel={canEditCatalogue ? `Edit ${item.name}` : item.name}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>{item.name}</Text>
                      <Text style={s.meta}>
                        {item.fee_type} · ₹{item.amount} · {item.billing_frequency}
                        {item.legacy_fee_type ? ` · legacy: ${item.legacy_fee_type}` : ""}
                      </Text>
                      <Text style={s.meta}>{item.code}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: item.active ? "#DCFCE7" : "#FEE2E2" }]}>
                      <Text style={[s.badgeTxt, { color: item.active ? "#15803D" : "#B91C1C" }]}>{item.active ? "Active" : "Off"}</Text>
                    </View>
                    {canEditCatalogue ? <Feather name="chevron-right" size={18} color="#94A3B8" style={{ marginLeft: 8 }} /> : null}
                  </RowWrap>
                );
              })}
            </>
          )}

          {tab === "plans" && (
            <>
              <Text style={s.section}>Fee plans ({plans.length})</Text>
              {plans.length === 0 ? (
                <EmptyState icon="layers" title="No fee plans" message={`No plans configured for ${entity.toUpperCase()} yet.`} />
              ) : plans.map((plan) => (
                <View key={plan.id} style={s.card}>
                  <Text style={s.cardTitle}>{plan.name}</Text>
                  {plan.is_default ? <Text style={s.defaultTag}>Default plan</Text> : null}
                  {plan.description ? <Text style={s.meta}>{plan.description}</Text> : null}
                  <Text style={s.meta}>
                    Match: {plan.match?.kind || "—"}
                    {plan.match?.player_type ? ` · ${plan.match.player_type}` : ""}
                    {plan.match?.sport ? ` · ${plan.match.sport}` : ""}
                    {plan.match?.is_resident != null ? ` · resident=${plan.match.is_resident}` : ""}
                  </Text>
                  {(plan.resolved_items || []).map((ri: any) => (
                    <View key={ri.id} style={s.planLine}>
                      <Text style={s.planLineName}>{ri.name}</Text>
                      <Text style={s.planLineAmt}>₹{ri.effective_amount ?? ri.amount}</Text>
                    </View>
                  ))}
                  {plan.rates && (
                    <Text style={s.ratesSummary}>
                      Rates: {Object.entries(plan.rates).map(([k, v]) => `${k}=₹${v}`).join(" · ")}
                    </Text>
                  )}
                </View>
              ))}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={!!editItem} animationType="fade" transparent onRequestClose={closeEdit}>
        <Pressable style={s.modalBackdrop} onPress={closeEdit}>
          <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={s.modalTitle}>Edit catalogue item</Text>
            {editItem ? (
              <>
                <FormLabel required>Name</FormLabel>
                <TextInput
                  style={[s.input, !editName.trim() && editErr ? s.inputErr : null]}
                  value={editName}
                  onChangeText={setEditName}
                  testID="edit-catalogue-name"
                />
                <FormLabel>Code</FormLabel>
                <TextInput style={[s.input, s.inputReadonly]} value={editItem.code} editable={false} />
                <Text style={s.fieldHint}>Code cannot be changed after creation.</Text>
                <FormLabel required>Amount</FormLabel>
                <TextInput
                  style={[s.input, (!editAmount.trim() || isNaN(parseFloat(editAmount))) && editErr ? s.inputErr : null]}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="numeric"
                  testID="edit-catalogue-amount"
                />
                <FormLabel>Category</FormLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                  {FEE_TYPES.map((ft) => (
                    <TouchableOpacity key={ft} style={[s.chip, editFeeType === ft && s.chipOn]} onPress={() => setEditFeeType(ft)}>
                      <Text style={[s.chipTxt, editFeeType === ft && s.chipTxtOn]}>{ft}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <FormLabel>Billing frequency</FormLabel>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {FREQUENCIES.map((f) => (
                    <TouchableOpacity key={f} style={[s.chip, editFrequency === f && s.chipOn]} onPress={() => setEditFrequency(f)}>
                      <Text style={[s.chipTxt, editFrequency === f && s.chipTxtOn]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <FormLabel>Status</FormLabel>
                <View style={s.statusRow}>
                  {([
                    { key: true, label: "Active" },
                    { key: false, label: "Inactive" },
                  ] as const).map((opt) => (
                    <TouchableOpacity
                      key={String(opt.key)}
                      style={[s.statusChip, editActive === opt.key && s.statusChipOn]}
                      onPress={() => setEditActive(opt.key)}
                      testID={`edit-catalogue-status-${opt.key ? "active" : "inactive"}`}
                    >
                      <Text style={[s.statusChipTxt, editActive === opt.key && s.statusChipTxtOn]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {editErr ? <InlineFieldError message={editErr} /> : null}
                <TouchableOpacity
                  style={[s.primaryBtn, (editSaving || editDeleting) && s.btnDisabled]}
                  onPress={saveEdit}
                  disabled={editSaving || editDeleting}
                  testID="edit-catalogue-save"
                >
                  <Text style={s.primaryBtnTxt}>{editSaving ? "Saving…" : "Save changes"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.deleteBtn, (editSaving || editDeleting) && s.btnDisabled]}
                  onPress={confirmDelete}
                  disabled={editSaving || editDeleting}
                  testID="edit-catalogue-delete"
                >
                  <Feather name="trash-2" size={16} color="#B91C1C" />
                  <Text style={s.deleteBtnTxt}>{editDeleting ? "Deleting…" : "Delete item"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={closeEdit} disabled={editSaving || editDeleting}>
                  <Text style={s.cancelBtnTxt}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 10, fontWeight: "700", color: "#64748B", letterSpacing: 1 },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  toastTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: "#065F46" },
  entityRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 8 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginTop: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E2E8F0" },
  tabOn: { backgroundColor: "#0891B2" },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#475569" },
  tabTxtOn: { color: "#fff" },
  scroll: { padding: 16, gap: 10 },
  section: { fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 8 },
  hint: { fontSize: 12, color: "#64748B", marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#E2E8F0", marginRight: 6 },
  chipOn: { backgroundColor: "#CFFAFE" },
  chipTxt: { fontSize: 12, color: "#475569" },
  chipTxtOn: { color: "#0E7490", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, backgroundColor: "#F8FAFC", color: "#0F172A" },
  inputReadonly: { backgroundColor: "#F1F5F9", color: "#64748B" },
  inputErr: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  fieldHint: { fontSize: 11, color: "#94A3B8", marginTop: -4 },
  formErr: { fontSize: 13, color: "#B91C1C", fontWeight: "600", marginTop: 8, textAlign: "center" },
  primaryBtn: { backgroundColor: "#0891B2", padding: 12, borderRadius: 10, alignItems: "center", marginTop: 4 },
  primaryBtnTxt: { color: "#fff", fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  listRowClickable: {
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  rowTitle: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  meta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  defaultTag: { fontSize: 11, color: "#0891B2", fontWeight: "700" },
  planLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  planLineName: { fontSize: 13, color: "#334155", flex: 1 },
  planLineAmt: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  ratesSummary: { fontSize: 11, color: "#64748B", marginTop: 6 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    gap: 8,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxHeight: "90%",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  statusChipOn: { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
  statusChipTxt: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  statusChipTxtOn: { color: "#15803D" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    marginTop: 4,
  },
  deleteBtnTxt: { color: "#B91C1C", fontWeight: "700" },
  cancelBtn: { padding: 10, alignItems: "center" },
  cancelBtnTxt: { color: "#64748B", fontWeight: "700" },
  btnDisabled: { opacity: 0.6 },
});

import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { LoadingState, EmptyState, ErrorState, FormLabel, InlineFieldError, getApiError } from "../../../src/ScreenStates";
import { useBreakpoint } from "../../../src/useBreakpoint";

type Tab = "catalogue" | "plans";

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
  const [items, setItems] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [feeType, setFeeType] = useState("tuition");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");

  const canManage = user?.role === "super_admin" || user?.permissions?.manage_fee_catalog || user?.permissions?.edit_fees;

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
    } catch (e: any) {
      setFormErr(getApiError(e, "Could not create catalogue item."));
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
              {items.length === 0 ? (
                <EmptyState icon="inbox" title="No catalogue items" message={`Add fee items for ${entity.toUpperCase()} to get started.`} />
              ) : items.map((item) => (
                <View key={item.id} style={s.listRow}>
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
                </View>
              ))}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 10, fontWeight: "700", color: "#64748B", letterSpacing: 1 },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  entityRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 8 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginTop: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E2E8F0" },
  tabOn: { backgroundColor: "#0891B2" },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#475569" },
  tabTxtOn: { color: "#fff" },
  scroll: { padding: 16, gap: 10 },
  section: { fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#E2E8F0", marginRight: 6 },
  chipOn: { backgroundColor: "#CFFAFE" },
  chipTxt: { fontSize: 12, color: "#475569" },
  chipTxtOn: { color: "#0E7490", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, backgroundColor: "#F8FAFC" },
  inputErr: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  formErr: { fontSize: 13, color: "#B91C1C", fontWeight: "600", marginTop: 8, textAlign: "center" },
  primaryBtn: { backgroundColor: "#0891B2", padding: 12, borderRadius: 10, alignItems: "center", marginTop: 4 },
  primaryBtnTxt: { color: "#fff", fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  rowTitle: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  meta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },
  defaultTag: { fontSize: 11, color: "#0891B2", fontWeight: "700" },
  planLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  planLineName: { fontSize: 13, color: "#334155", flex: 1 },
  planLineAmt: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  ratesSummary: { fontSize: 11, color: "#64748B", marginTop: 6 },
  empty: { color: "#94A3B8", fontSize: 13 },
});

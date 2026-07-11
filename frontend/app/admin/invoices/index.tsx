import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { formatDate } from "../../../src/dateFormat";

type EntityConfig = { entity_id: string; use_invoice_engine: boolean };
type Invoice = {
  id: string; invoice_number: string; person_name: string; entity_id: string;
  status: string; total_amount: number; amount_paid: number; balance_due: number; due_date?: string;
};

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function InvoicesAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const canView = isSuper || user?.permissions?.view_fees || user?.role === "principal" || user?.role === "vice_principal";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entities, setEntities] = useState<EntityConfig[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [reconcile, setReconcile] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cfg, inv] = await Promise.all([
        api.get("/invoices/config"),
        api.get("/invoices"),
      ]);
      setEntities(cfg.data.entities || []);
      setInvoices(inv.data || []);
    } catch {
      setEntities([]);
      setInvoices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (canView) load(); else setLoading(false); }, [load, canView]);

  const toggleEngine = async (entityId: string, val: boolean) => {
    if (!isSuper) return;
    setBusy(entityId);
    try {
      await api.patch(`/invoices/config/${entityId}`, { use_invoice_engine: val });
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to update flag");
    } finally { setBusy(null); }
  };

  const runReconcile = async (entityId: string) => {
    if (!isSuper) return;
    setBusy(`rec-${entityId}`);
    try {
      const { data } = await api.get(`/invoices/reconcile/${entityId}`);
      setReconcile(data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Reconciliation failed");
    } finally { setBusy(null); }
  };

  const runMigrate = async (entityId: string) => {
    if (!isSuper) return;
    Alert.alert(
      "Migrate legacy fees?",
      `Create opening invoices from all ${entityId.toUpperCase()} legacy fees. Idempotent — already migrated fees are skipped.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Migrate", style: "destructive", onPress: async () => {
          setBusy(`mig-${entityId}`);
          try {
            const { data } = await api.post(`/invoices/migrate-legacy/${entityId}`);
            Alert.alert("Done", `Created ${data.created_invoices} invoice(s), ${data.created_items} line(s).`);
            await load();
            await runReconcile(entityId);
          } catch (e: any) {
            Alert.alert("Error", e?.response?.data?.detail || "Migration failed");
          } finally { setBusy(null); }
        }},
      ],
    );
  };

  if (!canView) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>You do not have access to the invoice engine.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <SafeAreaView style={s.safe}><ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={20} color="#64748B" />
          <Text style={s.backTxt}>Back</Text>
        </TouchableOpacity>
        <Text style={s.overline}>FINANCE</Text>
        <Text style={s.h1}>Invoices & Payments</Text>
        <Text style={s.sub}>Parallel to legacy fees. Enable per entity after reconciliation. Supports partial payments, receipts, and refunds.</Text>

        <Text style={s.section}>Feature flags</Text>
        {entities.map((e) => (
          <View key={e.entity_id} style={s.card}>
            <View style={s.cardRow}>
              <Text style={s.cardTitle}>{e.entity_id.toUpperCase()}</Text>
              {isSuper ? (
                <Switch
                  value={!!e.use_invoice_engine}
                  onValueChange={(v) => toggleEngine(e.entity_id, v)}
                  disabled={busy === e.entity_id}
                />
              ) : (
                <Text style={s.badge}>{e.use_invoice_engine ? "ON" : "OFF"}</Text>
              )}
            </View>
            <Text style={s.cardHelp}>
              {e.use_invoice_engine
                ? "New invoice workflows active for this entity."
                : "Legacy fee collection remains the default."}
            </Text>
            {isSuper && (
              <View style={s.btnRow}>
                <TouchableOpacity style={s.btnGhost} onPress={() => runReconcile(e.entity_id)} disabled={!!busy}>
                  <Text style={s.btnGhostTxt}>Reconcile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnPrimary} onPress={() => runMigrate(e.entity_id)} disabled={!!busy}>
                  <Text style={s.btnPrimaryTxt}>Migrate legacy</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {reconcile && (
          <View style={s.reconcileBox}>
            <Text style={s.reconcileTitle}>Reconciliation — {reconcile.entity_id?.toUpperCase()}</Text>
            <Text style={s.reconcileLine}>Legacy fees: {reconcile.legacy?.fee_count} · {inr(reconcile.legacy?.total_amount)}</Text>
            <Text style={s.reconcileLine}>Proposed opening: {reconcile.proposed_opening?.invoice_count} invoices · {inr(reconcile.proposed_opening?.total_amount)}</Text>
            <Text style={[s.reconcileLine, { color: reconcile.reconciles ? "#15803D" : "#B45309", fontWeight: "800" }]}>
              {reconcile.reconciles ? "Totals reconcile" : "Mismatch — review before enabling engine"}
            </Text>
          </View>
        )}

        <Text style={s.section}>Invoices ({invoices.length})</Text>
        {invoices.length === 0 ? (
          <Text style={s.empty}>No invoices yet. Run migration or create via API.</Text>
        ) : invoices.map((inv) => (
          <TouchableOpacity key={inv.id} style={s.invRow} onPress={() => router.push(`/admin/invoices/${inv.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={s.invNum}>{inv.invoice_number}</Text>
              <Text style={s.invSub}>{inv.person_name} · {inv.entity_id?.toUpperCase()}</Text>
              <Text style={s.invSub}>Due {formatDate(inv.due_date)} · Balance {inr(inv.balance_due)}</Text>
            </View>
            <View style={[s.statusPill, inv.status === "paid" && s.statusPaid, (inv.status === "partially_paid" || inv.status === "partial") && s.statusPartial, inv.status === "overdue" && s.statusOverdue]}>
              <Text style={s.statusTxt}>{inv.status?.replace("partial", "partially_paid")}</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  backTxt: { color: "#64748B", fontWeight: "600" },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 6, marginBottom: 16 },
  section: { fontSize: 12, fontWeight: "800", color: "#0F172A", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 18, marginBottom: 10 },
  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  cardHelp: { fontSize: 12, color: "#64748B", marginTop: 6 },
  badge: { fontSize: 11, fontWeight: "800", color: "#1E40AF", backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  btnRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  btnGhost: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", alignItems: "center" },
  btnGhostTxt: { fontWeight: "700", color: "#475569", fontSize: 13 },
  btnPrimary: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#1E40AF", alignItems: "center" },
  btnPrimaryTxt: { fontWeight: "700", color: "#fff", fontSize: 13 },
  reconcileBox: { backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 12, padding: 12, marginBottom: 8 },
  reconcileTitle: { fontWeight: "800", color: "#92400E", marginBottom: 6 },
  reconcileLine: { fontSize: 12, color: "#78350F", marginTop: 2 },
  invRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, marginBottom: 8 },
  invNum: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  invSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "#F1F5F9" },
  statusPaid: { backgroundColor: "#DCFCE7" },
  statusPartial: { backgroundColor: "#FEF3C7" },
  statusOverdue: { backgroundColor: "#FEE2E2" },
  statusTxt: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", color: "#475569" },
  empty: { fontSize: 13, color: "#94A3B8", fontStyle: "italic" },
  denied: { padding: 24, textAlign: "center", color: "#64748B" },
});

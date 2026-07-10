import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api, useAuth } from "../src/auth";
import { useBreakpoint } from "../src/useBreakpoint";

// ---------- Types ----------
type DateQuick = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";
type ReportTab = "summary" | "defaulters" | "payment-modes";

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function computeDateRange(kind: DateQuick, from?: string, to?: string): { from: string; to: string } {
  const today = new Date();
  const t = iso(today);
  if (kind === "custom") return { from: from || "", to: to || "" };
  if (kind === "today") return { from: t, to: t };
  if (kind === "yesterday") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  if (kind === "this_week") {
    const s = new Date(today); s.setDate(s.getDate() - s.getDay()); // Sunday start
    return { from: iso(s), to: t };
  }
  if (kind === "this_month") {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(s), to: t };
  }
  if (kind === "last_month") {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const e = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(s), to: iso(e) };
  }
  return { from: "", to: "" };
}

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();

  const canAccess = user?.role === "super_admin" || user?.role === "admin";
  const isSportsAdmin = user?.role === "admin";

  // Global filters
  const [dateKind, setDateKind] = useState<DateQuick>("this_month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [institution, setInstitution] = useState<"BOTH" | "ALPHA" | "PWS">(isSportsAdmin ? "ALPHA" : "BOTH");
  const [centre, setCentre] = useState<"All" | "Balua" | "Harding Park">("All");
  const [sport, setSport] = useState<"All" | "Cricket" | "Football">("All");
  const [paymentStatus, setPaymentStatus] = useState<"all" | "paid" | "pending" | "overdue">("all");

  const [tab, setTab] = useState<ReportTab>("summary");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const range = useMemo(() => computeDateRange(dateKind, customFrom, customTo), [dateKind, customFrom, customTo]);

  useEffect(() => {
    if (!canAccess) return;
    load();
  }, [tab, dateKind, customFrom, customTo, institution, centre, sport, paymentStatus, canAccess]);

  const buildParams = () => {
    const p: any = { institution };
    if (range.from) p.date_from = range.from;
    if (range.to) p.date_to = range.to;
    if (centre !== "All") p.centre = centre;
    if (sport !== "All") p.sport = sport;
    if (paymentStatus !== "all") p.payment_status = paymentStatus;
    return p;
  };

  const load = async () => {
    setLoading(true); setError("");
    try {
      const r = await api.get(`/reports/financial/${tab}`, { params: buildParams() });
      setData(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load report");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const doExport = async () => {
    try {
      if (Platform.OS === "web") {
        const r = await api.get("/reports/financial/export", {
          params: { kind: tab, ...buildParams() },
          responseType: "blob",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(r.data);
        a.download = `pws-alpha-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        Alert.alert("Excel export", "Open the report on desktop web to download the .xlsx file.");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Could not download report";
      if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`Export failed: ${msg}`);
      else Alert.alert("Export failed", msg);
    }
  };

  if (!canAccess) {
    return (
      <SafeAreaView style={s.wrap}>
        <View style={{ padding: 24 }}>
          <Text style={s.h1}>Reports</Text>
          <Text style={{ marginTop: 12, color: "#64748B" }}>You do not have access to Reports.</Text>
          <TouchableOpacity testID="reports-denied-back" onPress={() => router.replace("/(tabs)")} style={{ marginTop: 16, alignSelf: "flex-start", backgroundColor: "#0F172A", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const body = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isDesktop ? 24 : 16, paddingBottom: 60 }}>
      {/* Page header */}
      <View style={s.header}>
        {!isDesktop && (
          <TouchableOpacity testID="reports-back" onPress={() => router.back()} style={s.backBtn}>
            <Feather name="chevron-left" size={22} color="#0F172A" />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>ANALYTICS · REPORTS</Text>
          <Text style={s.h1}>Reports</Text>
          <Text style={s.hSub}>Financial · Attendance · Operations · Audit</Text>
        </View>
        <TouchableOpacity testID="reports-export" onPress={doExport} style={s.exportBtn}>
          <Feather name="download" size={14} color="#fff" />
          <Text style={s.exportBtnTxt}>Export Excel</Text>
        </TouchableOpacity>
      </View>

      {/* Filters card */}
      <View style={s.filterCard}>
        <View style={s.filterHead}>
          <Feather name="filter" size={14} color="#1E40AF" />
          <Text style={s.filterHeadTxt}>Global Filters</Text>
        </View>
        <Text style={s.filterLabel}>Date range</Text>
        <View style={s.chipRow}>
          {(["today", "yesterday", "this_week", "this_month", "last_month", "custom"] as DateQuick[]).map((k) => (
            <TouchableOpacity key={k} testID={`date-${k}`} onPress={() => setDateKind(k)} style={[s.chip, dateKind === k && s.chipActive]}>
              <Text style={[s.chipTxt, dateKind === k && s.chipTxtActive]}>
                {k === "today" ? "Today" : k === "yesterday" ? "Yesterday" : k === "this_week" ? "This week" : k === "this_month" ? "This month" : k === "last_month" ? "Last month" : "Custom"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {dateKind === "custom" && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            {Platform.OS === "web" ? (
              <>
                {/* @ts-ignore */}
                <input data-testid="date-from" type="date" value={customFrom} onChange={(e: any) => setCustomFrom(e.target.value)} style={{ height: 40, flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, padding: 8 } as any} />
                {/* @ts-ignore */}
                <input data-testid="date-to" type="date" value={customTo} onChange={(e: any) => setCustomTo(e.target.value)} style={{ height: 40, flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, padding: 8 } as any} />
              </>
            ) : (
              <>
                <TextInput testID="date-from" placeholder="From YYYY-MM-DD" value={customFrom} onChangeText={setCustomFrom} style={s.input} />
                <TextInput testID="date-to" placeholder="To YYYY-MM-DD" value={customTo} onChangeText={setCustomTo} style={s.input} />
              </>
            )}
          </View>
        )}
        {(dateKind !== "custom") && (
          <Text style={s.rangeHelp}>{range.from} → {range.to}</Text>
        )}

        <Text style={s.filterLabel}>Institution</Text>
        <View style={s.chipRow}>
          {(isSportsAdmin ? (["ALPHA"] as const) : (["BOTH", "ALPHA", "PWS"] as const)).map((v) => (
            <TouchableOpacity key={v} testID={`inst-${v}`} onPress={() => setInstitution(v as any)} style={[s.chip, institution === v && s.chipActive]}>
              <Text style={[s.chipTxt, institution === v && s.chipTxtActive]}>{v === "BOTH" ? "Both" : v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.filterLabel}>Branch / Centre</Text>
        <View style={s.chipRow}>
          {(["All", "Balua", "Harding Park"] as const).map((v) => (
            <TouchableOpacity key={v} testID={`centre-${v}`} onPress={() => setCentre(v)} style={[s.chip, centre === v && s.chipActive]}>
              <Text style={[s.chipTxt, centre === v && s.chipTxtActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.filterLabel}>Sport</Text>
        <View style={s.chipRow}>
          {(["All", "Cricket", "Football"] as const).map((v) => (
            <TouchableOpacity key={v} testID={`sport-${v}`} onPress={() => setSport(v)} style={[s.chip, sport === v && s.chipActive]}>
              <Text style={[s.chipTxt, sport === v && s.chipTxtActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.filterLabel}>Payment status</Text>
        <View style={s.chipRow}>
          {(["all", "paid", "pending", "overdue"] as const).map((v) => (
            <TouchableOpacity key={v} testID={`ps-${v}`} onPress={() => setPaymentStatus(v)} style={[s.chip, paymentStatus === v && s.chipActive]}>
              <Text style={[s.chipTxt, paymentStatus === v && s.chipTxtActive]}>{v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Report tabs */}
      <View style={s.tabs}>
        <TabBtn label="Revenue Summary" active={tab === "summary"} onPress={() => setTab("summary")} testID="tab-summary" icon="pie-chart" />
        <TabBtn label="Defaulters & Aging" active={tab === "defaulters"} onPress={() => setTab("defaulters")} testID="tab-defaulters" icon="alert-triangle" />
        <TabBtn label="Payment Modes" active={tab === "payment-modes"} onPress={() => setTab("payment-modes")} testID="tab-payment-modes" icon="credit-card" />
      </View>

      {/* Report content */}
      {loading ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}><ActivityIndicator color="#1E40AF" /></View>
      ) : error ? (
        <View style={s.errorBox}>
          <Feather name="alert-circle" size={16} color="#DC2626" />
          <Text style={s.errorTxt}>{error}</Text>
        </View>
      ) : (
        <>
          {tab === "summary" && <SummaryView data={data} />}
          {tab === "defaulters" && <DefaultersView data={data} />}
          {tab === "payment-modes" && <PaymentModesView data={data} />}
        </>
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.wrap} testID="reports-screen">
      {body}
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress, testID, icon }: { label: string; active: boolean; onPress: () => void; testID: string; icon: any }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[s.tabBtn, active && s.tabBtnActive]}>
      <Feather name={icon} size={14} color={active ? "#fff" : "#475569"} />
      <Text style={[s.tabBtnTxt, active && s.tabBtnTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ---------- Summary View ----------
function SummaryView({ data }: { data: any }) {
  if (!data) return <Text style={s.empty}>No data.</Text>;
  const t = data.totals || {};
  return (
    <View style={{ gap: 12 }}>
      <View style={s.kpiRow}>
        <KPI label="Total Collected" value={inr(t.collected_all_time)} tint="#1E40AF" icon="trending-up" testID="kpi-collected" />
        <KPI label="Current Month" value={inr(t.current_month)} tint="#16A34A" icon="calendar" testID="kpi-current" />
        <KPI label="Previous Month" value={inr(t.previous_month)} tint="#0EA5E9" icon="clock" testID="kpi-prev" />
        <KPI label="Outstanding" value={inr(t.outstanding)} tint="#EA580C" icon="alert-triangle" testID="kpi-outstanding" />
      </View>

      <SectionCard title="Collection by Fee Head" icon="tag">
        {(data.by_fee_head || []).length === 0 ? <Text style={s.empty}>No collections in this window.</Text> : (
          <TableRows
            cols={["Fee Head", "Count", "Amount"]}
            rows={(data.by_fee_head || []).map((r: any) => [r.fee_head, String(r.count), inr(r.amount)])}
          />
        )}
      </SectionCard>

      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 280 }}>
          <SectionCard title="Collection by Centre" icon="map-pin">
            {(data.by_centre || []).length === 0 ? <Text style={s.empty}>—</Text> : (
              <TableRows
                cols={["Centre", "Count", "Amount"]}
                rows={(data.by_centre || []).map((r: any) => [r.centre, String(r.count), inr(r.collected)])}
              />
            )}
          </SectionCard>
        </View>
        <View style={{ flex: 1, minWidth: 280 }}>
          <SectionCard title="Collection by Sport" icon="target">
            {(data.by_sport || []).length === 0 ? <Text style={s.empty}>—</Text> : (
              <TableRows
                cols={["Sport", "Count", "Amount"]}
                rows={(data.by_sport || []).map((r: any) => [r.sport, String(r.count), inr(r.collected)])}
              />
            )}
          </SectionCard>
        </View>
      </View>
    </View>
  );
}

// ---------- Defaulters View ----------
function DefaultersView({ data }: { data: any }) {
  if (!data) return <Text style={s.empty}>No data.</Text>;
  const b = data.buckets || {};
  return (
    <View style={{ gap: 12 }}>
      <View style={s.kpiRow}>
        <KPI label="0–7 days" value={String(b["0_7"] || 0)} tint="#16A34A" icon="clock" testID="bucket-07" />
        <KPI label="8–15 days" value={String(b["8_15"] || 0)} tint="#0EA5E9" icon="clock" testID="bucket-815" />
        <KPI label="16–30 days" value={String(b["16_30"] || 0)} tint="#EA580C" icon="clock" testID="bucket-1630" />
        <KPI label=">30 days" value={String(b["gt_30"] || 0)} tint="#DC2626" icon="alert-octagon" testID="bucket-gt30" />
      </View>
      <SectionCard title={`Overdue Invoices (${(data.rows || []).length})`} icon="alert-triangle">
        {(data.rows || []).length === 0 ? <Text style={s.empty}>No overdue invoices.</Text> : (
          <TableRows
            cols={["Player", "Centre", "Sport", "Category", "Fee", "Amount", "Due Date", "Days Overdue"]}
            rows={(data.rows || []).slice(0, 200).map((r: any) => [
              r.player_name || "—",
              r.centre || "—",
              r.sport || "—",
              r.category || "—",
              r.fee_type || "—",
              inr(r.amount_due),
              r.due_date || "—",
              String(r.days_overdue),
            ])}
          />
        )}
      </SectionCard>
    </View>
  );
}

// ---------- Payment Modes View ----------
function PaymentModesView({ data }: { data: any }) {
  if (!data) return <Text style={s.empty}>No data.</Text>;
  const modes = data.summary || {};
  const modeEntries = Object.entries(modes) as [string, { count: number; sum: number }][];
  return (
    <View style={{ gap: 12 }}>
      <View style={s.kpiRow}>
        {modeEntries.length === 0 ? (
          <View style={s.emptyKpi}><Text style={s.empty}>No collections in this window.</Text></View>
        ) : modeEntries.map(([mode, agg]) => (
          <KPI key={mode} label={mode} value={inr(agg.sum)} tint={mode === "Cash" ? "#16A34A" : mode === "Online" ? "#0EA5E9" : "#7C3AED"} icon={mode === "Cash" ? "dollar-sign" : "credit-card"} testID={`mode-${mode}`} sub={`${agg.count} txn`} />
        ))}
      </View>
      <SectionCard title={`Transactions (${(data.transactions || []).length})`} icon="list">
        {(data.transactions || []).length === 0 ? <Text style={s.empty}>No transactions.</Text> : (
          <TableRows
            cols={["Player", "Centre", "Sport", "Fee", "Amount", "Mode", "Reference", "Paid At", "By"]}
            rows={(data.transactions || []).slice(0, 300).map((t: any) => [
              t.player_name || "—",
              t.centre || "—",
              t.sport || "—",
              t.fee_type || "—",
              inr(t.amount),
              t.payment_mode || "—",
              t.reference_id || "—",
              t.paid_at ? t.paid_at.slice(0, 10) : "—",
              t.collected_by_name || "—",
            ])}
          />
        )}
      </SectionCard>
    </View>
  );
}

function KPI({ label, value, tint, icon, testID, sub }: { label: string; value: string; tint: string; icon: any; testID?: string; sub?: string }) {
  return (
    <View style={[s.kpi, { borderLeftColor: tint }]} testID={testID}>
      <View style={[s.kpiIcon, { backgroundColor: `${tint}22` }]}>
        <Feather name={icon} size={16} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.kpiLabel}>{label}</Text>
        <Text style={s.kpiValue}>{value}</Text>
        {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function SectionCard({ title, icon, children }: any) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}><Feather name={icon} size={14} color="#1E40AF" /><Text style={s.sectionTitle}>{title}</Text></View>
      {children}
    </View>
  );
}

function TableRows({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 8 }}>
      <View>
        <View style={s.tRow}>
          {cols.map((c, idx) => (
            <Text key={idx} style={[s.tHeadCell, { minWidth: idx === 0 ? 160 : 100 }]}>{c}</Text>
          ))}
        </View>
        {rows.map((r, ri) => (
          <View key={ri} style={[s.tRow, ri % 2 === 1 && { backgroundColor: "#F8FAFC" }]}>
            {r.map((v, ci) => (
              <Text key={ci} style={[s.tCell, { minWidth: ci === 0 ? 160 : 100 }]}>{v}</Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: "#EFF6FF" },
  overline: { fontSize: 10, color: "#1E40AF", fontWeight: "800", letterSpacing: 0.8 },
  h1: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  hSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1E40AF", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  exportBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.3 },
  filterCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  filterHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  filterHeadTxt: { color: "#1E40AF", fontWeight: "800", fontSize: 12, letterSpacing: 0.4, textTransform: "uppercase" },
  filterLabel: { fontSize: 11, color: "#475569", fontWeight: "700", marginTop: 10, textTransform: "uppercase", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  input: { height: 40, flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 10, fontSize: 13 },
  rangeHelp: { fontSize: 11, color: "#94A3B8", marginTop: 4, fontStyle: "italic" },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  tabBtnActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  tabBtnTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  tabBtnTxtActive: { color: "#fff" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, padding: 12, borderRadius: 10 },
  errorTxt: { color: "#B91C1C", fontSize: 13 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { flex: 1, minWidth: 200, flexDirection: "row", gap: 10, backgroundColor: "#fff", padding: 14, borderRadius: 10, borderLeftWidth: 4, borderColor: "#E2E8F0", borderWidth: 1 },
  kpiIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  kpiLabel: { fontSize: 11, color: "#64748B", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 18, color: "#0F172A", fontWeight: "800", marginTop: 2 },
  kpiSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  emptyKpi: { flex: 1, padding: 20, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  tRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  tHeadCell: { fontSize: 11, fontWeight: "800", color: "#475569", textTransform: "uppercase", letterSpacing: 0.4, paddingHorizontal: 8 },
  tCell: { fontSize: 12, color: "#0F172A", paddingHorizontal: 8 },
  empty: { color: "#94A3B8", fontStyle: "italic", padding: 12, fontSize: 12 },
});

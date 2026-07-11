import React, { useState, useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api, useAuth } from "../src/auth";
import { useBreakpoint } from "../src/useBreakpoint";
import { DataTable, EmptyState, LoadingState, ErrorState } from "../src/ScreenStates";
import { formatDate, formatDateTime, formatMonth, DATE_PLACEHOLDER, parseToISO } from "../src/dateFormat";

type DateQuick = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";
type ReportTab = "summary" | "defaulters" | "payment-modes";
type ReportMode = "mvp" | "financial";

const MVP_REPORTS = [
  { id: "students", title: "Student List", category: "People", icon: "users" },
  { id: "players", title: "Player List", category: "People", icon: "target" },
  { id: "staff", title: "Staff List", category: "People", icon: "briefcase" },
  { id: "attendance-summary", title: "Attendance Summary", category: "Attendance", icon: "bar-chart-2" },
  { id: "attendance-detail", title: "Attendance Detail", category: "Attendance", icon: "check-square" },
  { id: "fee-collection", title: "Fee Collection", category: "Finance", icon: "dollar-sign" },
  { id: "outstanding-invoices", title: "Outstanding Invoices", category: "Finance", icon: "alert-circle" },
  { id: "payment-receipts", title: "Payment Receipts", category: "Finance", icon: "file-text" },
  { id: "marks-summary", title: "Marks Summary", category: "Academic", icon: "book-open" },
  { id: "report-card-status", title: "Report Card Status", category: "Academic", icon: "award" },
] as const;

const GRADES = ["All", "6", "7", "8", "9", "10", "11", "12"];
const STATUS_OPTS = ["All", "active", "inactive", "present", "absent", "late", "leave", "draft", "published", "issued", "overdue"];

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function computeDateRange(kind: DateQuick, from?: string, to?: string): { from: string; to: string } {
  const today = new Date();
  const t = iso(today);
  if (kind === "custom") {
    const fromIso = from ? (parseToISO(from) || from) : "";
    const toIso = to ? (parseToISO(to) || to) : "";
    return { from: fromIso, to: toIso };
  }
  if (kind === "today") return { from: t, to: t };
  if (kind === "yesterday") {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  if (kind === "this_week") {
    const s = new Date(today); s.setDate(s.getDate() - s.getDay());
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

function entityParam(inst: "BOTH" | "ALPHA" | "PWS") {
  if (inst === "BOTH") return "both";
  return inst.toLowerCase();
}

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDesktop, horizontalPadding, contentMaxWidth } = useBreakpoint();
  const printRef = useRef<View>(null);

  const canAccess = user?.role === "super_admin" || user?.role === "admin" || user?.role === "principal" || user?.role === "vice_principal";
  const isSportsAdmin = user?.role === "admin";
  const isPwsAdmin = user?.role === "principal" || user?.role === "vice_principal";
  const canPickEntity = user?.role === "super_admin" || user?.organization === "BOTH";

  const [mode, setMode] = useState<ReportMode>("mvp");
  const [mvpReportId, setMvpReportId] = useState("students");
  const [dateKind, setDateKind] = useState<DateQuick>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [institution, setInstitution] = useState<"BOTH" | "ALPHA" | "PWS">(isSportsAdmin ? "ALPHA" : isPwsAdmin ? "PWS" : "BOTH");
  const [centre, setCentre] = useState("All");
  const [sport, setSport] = useState("All");
  const [grade, setGrade] = useState("All");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState("All");
  const [paymentStatus, setPaymentStatus] = useState<"all" | "paid" | "pending" | "overdue">("all");
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);

  const [tab, setTab] = useState<ReportTab>("summary");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  const range = useMemo(() => computeDateRange(dateKind, customFrom, customTo), [dateKind, customFrom, customTo]);
  const mvpMeta = useMemo(() => MVP_REPORTS.find((r) => r.id === mvpReportId), [mvpReportId]);

  useEffect(() => {
    if (!canAccess) return;
    api.get("/academic/sections").then((r) => setSections(r.data || [])).catch(() => {});
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    load();
  }, [mode, mvpReportId, tab, dateKind, customFrom, customTo, institution, centre, sport, grade, sectionId, status, paymentStatus, canAccess]);

  const buildMvpParams = () => {
    const p: Record<string, string> = { entity: entityParam(institution) };
    if (range.from) p.date_from = range.from;
    if (range.to) p.date_to = range.to;
    if (centre !== "All") p.centre = centre;
    if (sport !== "All") p.sport = sport;
    if (grade !== "All") p.grade = grade;
    if (sectionId) p.section_id = sectionId;
    if (status !== "All") p.status = status;
    return p;
  };

  const buildFinancialParams = () => {
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
      if (mode === "mvp") {
        const r = await api.get(`/reports/${mvpReportId}`, { params: buildMvpParams() });
        setData(r.data);
      } else {
        const r = await api.get(`/reports/financial/${tab}`, { params: buildFinancialParams() });
        setData(r.data);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load report");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const doExport = async (format: "xlsx" | "pdf") => {
    try {
      if (Platform.OS !== "web") {
        Alert.alert("Export", "Open Reports on desktop web to download files.");
        return;
      }
      if (mode === "mvp") {
        const r = await api.get(`/reports/${mvpReportId}/export`, {
          params: { format, ...buildMvpParams() },
          responseType: "blob",
        });
        const ext = format === "pdf" ? "pdf" : "xlsx";
        const a = document.createElement("a");
        a.href = URL.createObjectURL(r.data);
        a.download = `${mvpReportId}-${new Date().toISOString().slice(0, 10)}.${ext}`;
        if (format === "pdf") a.target = "_blank";
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        const r = await api.get("/reports/financial/export", {
          params: { kind: tab, ...buildFinancialParams() },
          responseType: "blob",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(r.data);
        a.download = `pws-alpha-${tab}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Could not export";
      if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`Export failed: ${msg}`);
      else Alert.alert("Export failed", msg);
    }
  };

  const doPrint = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.print();
    } else {
      Alert.alert("Print", "Open Reports on desktop web for printable layout.");
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

  const categories = [...new Set(MVP_REPORTS.map((r) => r.category))];

  return (
    <SafeAreaView style={s.wrap} testID="reports-screen">
      {Platform.OS === "web" && (
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #report-print-area, #report-print-area * { visibility: visible; }
            #report-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
            .no-print { display: none !important; }
          }
        `}</style>
      )}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isDesktop ? 24 : horizontalPadding, paddingBottom: 60, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }}>
        <View style={s.header}>
          {!isDesktop && (
            <TouchableOpacity testID="reports-back" onPress={() => router.back()} style={s.backBtn}>
              <Feather name="chevron-left" size={22} color="#0F172A" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>ANALYTICS · REPORTS</Text>
            <Text style={s.h1}>Reports & Exports</Text>
            <Text style={s.hSub}>People · Attendance · Finance · Academic</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <TouchableOpacity testID="reports-export-xlsx" onPress={() => doExport("xlsx")} style={s.exportBtn}>
              <Feather name="download" size={14} color="#fff" />
              <Text style={s.exportBtnTxt}>Excel</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="reports-export-pdf" onPress={() => doExport("pdf")} style={[s.exportBtn, { backgroundColor: "#0F172A" }]}>
              <Feather name="file" size={14} color="#fff" />
              <Text style={s.exportBtnTxt}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="reports-print" onPress={doPrint} style={[s.exportBtn, { backgroundColor: "#475569" }]}>
              <Feather name="printer" size={14} color="#fff" />
              <Text style={s.exportBtnTxt}>Print</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.filterCard}>
          <View style={s.filterHead}>
            <Feather name="filter" size={14} color="#1E40AF" />
            <Text style={s.filterHeadTxt}>Filters</Text>
          </View>

          <Text style={s.filterLabel}>Report type</Text>
          <View style={s.chipRow}>
            <TouchableOpacity testID="mode-mvp" onPress={() => setMode("mvp")} style={[s.chip, mode === "mvp" && s.chipActive]}>
              <Text style={[s.chipTxt, mode === "mvp" && s.chipTxtActive]}>Standard Reports</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="mode-financial" onPress={() => setMode("financial")} style={[s.chip, mode === "financial" && s.chipActive]}>
              <Text style={[s.chipTxt, mode === "financial" && s.chipTxtActive]}>Financial Analytics</Text>
            </TouchableOpacity>
          </View>

          {mode === "mvp" && categories.map((cat) => (
            <View key={cat}>
              <Text style={s.filterLabel}>{cat}</Text>
              <View style={s.chipRow}>
                {MVP_REPORTS.filter((r) => r.category === cat).map((r) => (
                  <TouchableOpacity key={r.id} testID={`report-${r.id}`} onPress={() => setMvpReportId(r.id)} style={[s.chip, mvpReportId === r.id && s.chipActive]}>
                    <Text style={[s.chipTxt, mvpReportId === r.id && s.chipTxtActive]}>{r.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

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
              <TextInput testID="date-from" placeholder={`From ${DATE_PLACEHOLDER}`} value={customFrom} onChangeText={setCustomFrom} style={s.input} />
              <TextInput testID="date-to" placeholder={`To ${DATE_PLACEHOLDER}`} value={customTo} onChangeText={setCustomTo} style={s.input} />
            </View>
          )}
          {dateKind !== "custom" && <Text style={s.rangeHelp}>{formatDate(range.from)} → {formatDate(range.to)}</Text>}

          <Text style={s.filterLabel}>Entity</Text>
          <View style={s.chipRow}>
            {(isSportsAdmin ? (["ALPHA"] as const) : canPickEntity ? (["BOTH", "ALPHA", "PWS"] as const) : (["PWS"] as const)).map((v) => (
              <TouchableOpacity key={v} testID={`inst-${v}`} onPress={() => setInstitution(v as any)} style={[s.chip, institution === v && s.chipActive]}>
                <Text style={[s.chipTxt, institution === v && s.chipTxtActive]}>{v === "BOTH" ? "Combined" : v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.filterLabel}>Centre</Text>
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

          <Text style={s.filterLabel}>Grade</Text>
          <View style={s.chipRow}>
            {GRADES.map((v) => (
              <TouchableOpacity key={v} testID={`grade-${v}`} onPress={() => setGrade(v)} style={[s.chip, grade === v && s.chipActive]}>
                <Text style={[s.chipTxt, grade === v && s.chipTxtActive]}>{v === "All" ? "All" : `Class ${v}`}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sections.length > 0 && (
            <>
              <Text style={s.filterLabel}>Section</Text>
              <View style={s.chipRow}>
                <TouchableOpacity testID="section-all" onPress={() => setSectionId("")} style={[s.chip, !sectionId && s.chipActive]}>
                  <Text style={[s.chipTxt, !sectionId && s.chipTxtActive]}>All</Text>
                </TouchableOpacity>
                {sections.slice(0, 12).map((sec) => (
                  <TouchableOpacity key={sec.id} testID={`section-${sec.id}`} onPress={() => setSectionId(sec.id)} style={[s.chip, sectionId === sec.id && s.chipActive]}>
                    <Text style={[s.chipTxt, sectionId === sec.id && s.chipTxtActive]}>{sec.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={s.filterLabel}>Status</Text>
          <View style={s.chipRow}>
            {STATUS_OPTS.map((v) => (
              <TouchableOpacity key={v} testID={`status-${v}`} onPress={() => setStatus(v)} style={[s.chip, status === v && s.chipActive]}>
                <Text style={[s.chipTxt, status === v && s.chipTxtActive]}>{v === "All" ? "All" : v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === "financial" && (
            <>
              <Text style={s.filterLabel}>Payment status</Text>
              <View style={s.chipRow}>
                {(["all", "paid", "pending", "overdue"] as const).map((v) => (
                  <TouchableOpacity key={v} testID={`ps-${v}`} onPress={() => setPaymentStatus(v)} style={[s.chip, paymentStatus === v && s.chipActive]}>
                    <Text style={[s.chipTxt, paymentStatus === v && s.chipTxtActive]}>{v === "all" ? "All" : v[0].toUpperCase() + v.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {mode === "financial" && (
          <View style={s.tabs}>
            <TabBtn label="Revenue Summary" active={tab === "summary"} onPress={() => setTab("summary")} testID="tab-summary" icon="pie-chart" />
            <TabBtn label="Defaulters & Aging" active={tab === "defaulters"} onPress={() => setTab("defaulters")} testID="tab-defaulters" icon="alert-triangle" />
            <TabBtn label="Payment Modes" active={tab === "payment-modes"} onPress={() => setTab("payment-modes")} testID="tab-payment-modes" icon="credit-card" />
          </View>
        )}

        <View nativeID="report-print-area" ref={printRef}>
          {mode === "mvp" && data && (
            <View style={s.printHeader}>
              <Text style={s.printTitle}>{data.title || mvpMeta?.title}</Text>
              <Text style={s.printSub}>
                {data.entity_scope_label || institution} · {formatDateTime(data.generated_at)} · {data.summary?.total_rows ?? 0} rows
              </Text>
            </View>
          )}

          {loading ? (
            <LoadingState message="Generating report…" />
          ) : error ? (
            <ErrorState message={error} onRetry={load} compact />
          ) : mode === "mvp" ? (
            <MvpReportView data={data} />
          ) : (
            <>
              {tab === "summary" && <SummaryView data={data} />}
              {tab === "defaulters" && <DefaultersView data={data} />}
              {tab === "payment-modes" && <PaymentModesView data={data} />}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MvpReportView({ data }: { data: any }) {
  if (!data) return <Text style={s.empty}>No data.</Text>;
  const cols: string[] = data.columns || [];
  const rows: any[] = data.rows || [];
  const keys: string[] = data.row_keys || (rows[0] ? Object.keys(rows[0]) : []);
  const summary = data.summary || {};

  return (
    <View style={{ gap: 12 }}>
      {Object.keys(summary).filter((k) => k !== "total_rows").length > 0 && (
        <View style={s.kpiRow}>
          {summary.total_collected != null && <KPI label="Total Collected" value={inr(summary.total_collected)} tint="#16A34A" icon="dollar-sign" />}
          {summary.total_outstanding != null && <KPI label="Outstanding" value={inr(summary.total_outstanding)} tint="#EA580C" icon="alert-triangle" />}
          {summary.total_amount != null && <KPI label="Total Amount" value={inr(summary.total_amount)} tint="#1E40AF" icon="credit-card" />}
          {summary.totals_by_status && Object.entries(summary.totals_by_status).map(([st, cnt]) => (
            <KPI key={st} label={st} value={String(cnt)} tint="#0EA5E9" icon="check-circle" />
          ))}
          {summary.by_status && Object.entries(summary.by_status).map(([st, cnt]) => (
            <KPI key={st} label={st} value={String(cnt)} tint="#7C3AED" icon="file-text" />
          ))}
        </View>
      )}
      <SectionCard title={`${data.title} (${rows.length})`} icon="list">
        {rows.length === 0 ? (
          <EmptyState icon="filter" title="No matching rows" message="Try adjusting your filters or date range." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ minWidth: "100%" }}>
              <DataTable
                columns={cols}
                rows={rows.slice(0, 500).map((r: any) => keys.map((k) => {
                  const v = r[k];
                  if (k === "amount" || k === "total" || k === "paid" || k === "balance") return inr(Number(v) || 0);
                  if (k.endsWith("_at") || k === "timestamp") return formatDateTime(v);
                  if (k.endsWith("_date") || k === "date" || k.endsWith("_month")) {
                    return k.endsWith("_month") ? formatMonth(v) : formatDate(v);
                  }
                  if (typeof v === "string" && v.length > 10 && v.includes("T")) return formatDateTime(v);
                  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDate(v);
                  return v != null ? String(v) : "—";
                }))}
                numericFromIndex={cols.findIndex((c) => /amount|total|paid|balance|collected/i.test(c)) >= 0 ? cols.findIndex((c) => /amount|total|paid|balance|collected/i.test(c)) : 1}
              />
            </View>
          </ScrollView>
        )}
      </SectionCard>
    </View>
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
          <TableRows cols={["Fee Head", "Count", "Amount"]} rows={(data.by_fee_head || []).map((r: any) => [r.fee_head, String(r.count), inr(r.amount)])} />
        )}
      </SectionCard>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 280 }}>
          <SectionCard title="Collection by Centre" icon="map-pin">
            {(data.by_centre || []).length === 0 ? <Text style={s.empty}>—</Text> : (
              <TableRows cols={["Centre", "Count", "Amount"]} rows={(data.by_centre || []).map((r: any) => [r.centre, String(r.count), inr(r.collected)])} />
            )}
          </SectionCard>
        </View>
        <View style={{ flex: 1, minWidth: 280 }}>
          <SectionCard title="Collection by Sport" icon="target">
            {(data.by_sport || []).length === 0 ? <Text style={s.empty}>—</Text> : (
              <TableRows cols={["Sport", "Count", "Amount"]} rows={(data.by_sport || []).map((r: any) => [r.sport, String(r.count), inr(r.collected)])} />
            )}
          </SectionCard>
        </View>
      </View>
    </View>
  );
}

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
              r.player_name || "—", r.centre || "—", r.sport || "—", r.category || "—",
              r.fee_type || "—", inr(r.amount_due), formatDate(r.due_date), String(r.days_overdue),
            ])}
          />
        )}
      </SectionCard>
    </View>
  );
}

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
              t.player_name || "—", t.centre || "—", t.sport || "—", t.fee_type || "—",
              inr(t.amount), t.payment_mode || "—", t.reference_id || "—",
              t.paid_at ? formatDateTime(t.paid_at) : "—", t.collected_by_name || "—",
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
  const numIdx = cols.findIndex((c) => /amount|count|₹/i.test(c));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: 8 }}>
      <View style={{ minWidth: "100%" }}>
        <DataTable columns={cols} rows={rows} numericFromIndex={numIdx >= 0 ? numIdx : 1} />
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
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1E40AF", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  exportBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.3 },
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
  printHeader: { marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  printTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A" },
  printSub: { fontSize: 11, color: "#64748B", marginTop: 4 },
});

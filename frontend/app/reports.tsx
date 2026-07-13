import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, Alert, Modal, Pressable, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { api, useAuth, userHasPermission } from "../src/auth";
import { BusinessEntity, Permission, UserRole, normalizeRole } from "../src/rbac";
import { useBreakpoint } from "../src/useBreakpoint";
import { DataTable, EmptyState, LoadingState, ErrorState } from "../src/ScreenStates";
import { formatDate, formatDateTime, formatMonth, DATE_PLACEHOLDER, parseToISO } from "../src/dateFormat";
import { colors, radii, spacing } from "../src/theme";

type RunState = "idle" | "loading" | "ready" | "outdated" | "error";
type PeriodKind = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

type ReportId = typeof MVP_REPORTS[number]["id"];

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

const CATEGORIES = ["People", "Attendance", "Finance", "Academic"] as const;
const PERIOD_OPTIONS: { key: PeriodKind; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "this_year", label: "This year" },
  { key: "custom", label: "Custom" },
];

const GRADES = ["All", "6", "7", "8", "9", "10", "11", "12"];
const CENTRES = ["All", "Balua", "Harding Park"] as const;
const SPORTS = ["All", "Cricket", "Football"] as const;
const ATTENDANCE_STATUSES = ["All", "present", "absent", "late", "leave"] as const;
const INVOICE_STATUSES = ["All", "issued", "overdue", "partially_paid", "paid", "draft"] as const;
const PAYMENT_METHODS = ["All", "Cash", "Online", "UPI", "Cheque"] as const;

const ACADEMIC_REPORTS = new Set(["students", "marks-summary", "report-card-status", "attendance-summary", "attendance-detail"]);
const SPORTS_REPORTS = new Set(["players", "attendance-summary", "attendance-detail", "fee-collection", "payment-receipts"]);
const FINANCE_REPORTS = new Set(["fee-collection", "outstanding-invoices", "payment-receipts"]);
const ATTENDANCE_REPORTS = new Set(["attendance-summary", "attendance-detail"]);

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

function computeDateRange(kind: PeriodKind, from?: string, to?: string): { from: string; to: string } {
  const today = new Date();
  const t = iso(today);
  if (kind === "custom") {
    return {
      from: from ? (parseToISO(from) || from) : "",
      to: to ? (parseToISO(to) || to) : "",
    };
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
  if (kind === "this_quarter") {
    const qStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const s = new Date(today.getFullYear(), qStartMonth, 1);
    return { from: iso(s), to: t };
  }
  if (kind === "this_year") {
    const s = new Date(today.getFullYear(), 0, 1);
    return { from: iso(s), to: t };
  }
  return { from: "", to: "" };
}

function entityParam(inst: "BOTH" | "ALPHA" | "PWS") {
  if (inst === "BOTH") return "both";
  return inst.toLowerCase();
}

function entityLabel(inst: "BOTH" | "ALPHA" | "PWS") {
  if (inst === "BOTH") return "Combined";
  return inst;
}

function periodLabel(kind: PeriodKind) {
  return PERIOD_OPTIONS.find((p) => p.key === kind)?.label || kind;
}

function reportMeta(id: string) {
  return MVP_REPORTS.find((r) => r.id === id);
}

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDesktop, isMobile, horizontalPadding, contentMaxWidth } = useBreakpoint();
  const { width } = useWindowDimensions();
  const printRef = useRef<View>(null);

  const canAccess = userHasPermission(user, Permission.RUN_PWS_REPORTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.RUN_ALPHA_REPORTS, BusinessEntity.ALPHA);
  const isSportsAdmin = normalizeRole(user?.role || "") === UserRole.ALPHA_ADMIN;
  const isPwsAdmin = normalizeRole(user?.role || "") === UserRole.PWS_ADMIN;
  const canPickEntity = userHasPermission(user, Permission.MANAGE_ACCESS) || user?.organization === "BOTH";

  const [mvpReportId, setMvpReportId] = useState<ReportId>("students");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [institution, setInstitution] = useState<"BOTH" | "ALPHA" | "PWS">(isSportsAdmin ? "ALPHA" : isPwsAdmin ? "PWS" : "BOTH");

  const [centre, setCentre] = useState("All");
  const [sport, setSport] = useState("All");
  const [grade, setGrade] = useState("All");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);

  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [reportSearch, setReportSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [exportParams, setExportParams] = useState<Record<string, string> | null>(null);
  const [snapshotKey, setSnapshotKey] = useState<string | null>(null);

  const range = useMemo(() => computeDateRange(periodKind, customFrom, customTo), [periodKind, customFrom, customTo]);
  const mvpMeta = useMemo(() => reportMeta(mvpReportId), [mvpReportId]);

  const filterSnapshotKey = useMemo(() => JSON.stringify({
    mvpReportId,
    institution,
    periodKind,
    customFrom,
    customTo,
    from: range.from,
    to: range.to,
    centre,
    sport,
    grade,
    sectionId,
    status,
    paymentMethod,
  }), [mvpReportId, institution, periodKind, customFrom, customTo, range.from, range.to, centre, sport, grade, sectionId, status, paymentMethod]);

  const entityOptions = useMemo(() => {
    if (isSportsAdmin) return ["ALPHA"] as const;
    if (canPickEntity) return ["BOTH", "PWS", "ALPHA"] as const;
    return ["PWS"] as const;
  }, [isSportsAdmin, canPickEntity]);

  const showAcademic = ACADEMIC_REPORTS.has(mvpReportId);
  const showSports = SPORTS_REPORTS.has(mvpReportId);
  const showFinance = FINANCE_REPORTS.has(mvpReportId);
  const showAttendance = ATTENDANCE_REPORTS.has(mvpReportId);

  const advancedFilterCount = useMemo(() => {
    let n = 0;
    if (centre !== "All") n++;
    if (sport !== "All") n++;
    if (grade !== "All") n++;
    if (sectionId) n++;
    if (status !== "All") n++;
    if (paymentMethod !== "All") n++;
    if (periodKind === "custom" && (customFrom || customTo)) n++;
    return n;
  }, [centre, sport, grade, sectionId, status, paymentMethod, periodKind, customFrom, customTo]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    chips.push({ key: "entity", label: `Entity: ${entityLabel(institution)}`, onRemove: () => {} });
    chips[chips.length - 1].onRemove = () => {}; // entity always shown, not removable to empty

    const periodText = periodKind === "custom"
      ? `Period: ${customFrom || "…"} – ${customTo || "…"}`
      : `Period: ${periodLabel(periodKind)}`;
    if (periodKind !== "this_month") {
      chips.push({
        key: "period",
        label: periodText,
        onRemove: () => { setPeriodKind("this_month"); setCustomFrom(""); setCustomTo(""); },
      });
    }

    if (centre !== "All") chips.push({ key: "centre", label: `Centre: ${centre}`, onRemove: () => setCentre("All") });
    if (sport !== "All") chips.push({ key: "sport", label: `Sport: ${sport}`, onRemove: () => setSport("All") });
    if (grade !== "All") chips.push({ key: "grade", label: `Grade: Class ${grade}`, onRemove: () => setGrade("All") });
    if (sectionId) {
      const sec = sections.find((x) => x.id === sectionId);
      chips.push({ key: "section", label: `Section: ${sec?.label || sectionId}`, onRemove: () => setSectionId("") });
    }
    if (status !== "All") chips.push({ key: "status", label: `Status: ${status}`, onRemove: () => setStatus("All") });
    if (paymentMethod !== "All") chips.push({ key: "payment", label: `Payment: ${paymentMethod}`, onRemove: () => setPaymentMethod("All") });
    return chips;
  }, [institution, periodKind, customFrom, customTo, centre, sport, grade, sectionId, status, paymentMethod, sections]);

  const canExport = runState === "ready" && !!data && !!exportParams && !loading;
  const showPreview = runState === "loading" || runState === "ready" || runState === "outdated" || runState === "error";
  const customRangeIncomplete = periodKind === "custom" && (!range.from || !range.to);

  const buildMvpParams = useCallback(() => {
    const p: Record<string, string> = { entity: entityParam(institution) };
    if (range.from) p.date_from = range.from;
    if (range.to) p.date_to = range.to;
    if (centre !== "All") p.centre = centre;
    if (sport !== "All") p.sport = sport;
    if (grade !== "All") p.grade = grade;
    if (sectionId) p.section_id = sectionId;
    if (status !== "All") p.status = status;
    return p;
  }, [institution, range, centre, sport, grade, sectionId, status]);

  const runReport = useCallback(async () => {
    if (customRangeIncomplete) {
      setFiltersOpen(true);
      Alert.alert("Date range required", `Open Filters and enter From and To dates (${DATE_PLACEHOLDER}).`);
      return;
    }
    setRunState("loading");
    setLoading(true);
    setError("");
    const params = buildMvpParams();
    try {
      const r = await api.get(`/reports/${mvpReportId}`, { params });
      setData(r.data);
      setLastLoadedAt(new Date().toISOString());
      setExportParams(params);
      setSnapshotKey(filterSnapshotKey);
      setRunState("ready");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load report");
      setData(null);
      setExportParams(null);
      setRunState("error");
    } finally {
      setLoading(false);
    }
  }, [mvpReportId, buildMvpParams, customRangeIncomplete, filterSnapshotKey]);

  useEffect(() => {
    if (!canAccess) return;
    api.get("/academic/sections").then((r) => setSections(r.data || [])).catch(() => {});
  }, [canAccess]);

  useEffect(() => {
    setRunState("idle");
    setData(null);
    setError("");
    setExportParams(null);
    setSnapshotKey(null);
    setLastLoadedAt(null);
  }, [mvpReportId]);

  useEffect(() => {
    if (runState === "ready" && snapshotKey && snapshotKey !== filterSnapshotKey) {
      setRunState("outdated");
    }
  }, [filterSnapshotKey, snapshotKey, runState]);

  const clearAllFilters = () => {
    setCentre("All");
    setSport("All");
    setGrade("All");
    setSectionId("");
    setStatus("All");
    setPaymentMethod("All");
    setPeriodKind("this_month");
    setCustomFrom("");
    setCustomTo("");
    if (runState === "ready") setRunState("outdated");
  };

  const filteredReports = useMemo(() => {
    const q = reportSearch.trim().toLowerCase();
    if (!q) return MVP_REPORTS;
    return MVP_REPORTS.filter((r) => r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [reportSearch]);

  const doExport = async (format: "xlsx" | "pdf") => {
    if (!canExport || !exportParams) return;
    try {
      if (Platform.OS !== "web") {
        Alert.alert("Export", "Open Reports on desktop web to download files.");
        return;
      }
      const r = await api.get(`/reports/${mvpReportId}/export`, {
        params: { format, ...exportParams },
        responseType: "blob",
      });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(r.data);
      a.download = `${mvpReportId}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      if (format === "pdf") a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setExportMenuOpen(false);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Could not export";
      if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`Export failed: ${msg}`);
      else Alert.alert("Export failed", msg);
    }
  };

  const doPrint = () => {
    if (!canExport) return;
    if (Platform.OS === "web" && typeof window !== "undefined") window.print();
    else Alert.alert("Print", "Open Reports on desktop web for printable layout.");
    setExportMenuOpen(false);
  };

  if (!canAccess) {
    return (
      <SafeAreaView style={s.wrap}>
        <View style={{ padding: 24 }}>
          <Text style={s.h1}>Reports</Text>
          <Text style={{ marginTop: 12, color: colors.muted2 }}>You do not have access to Reports.</Text>
          <TouchableOpacity testID="reports-denied-back" onPress={() => router.replace("/(tabs)/dashboard")} style={s.deniedBtn}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const setupStacked = !isDesktop || width < 900;

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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isDesktop ? spacing.xl : horizontalPadding,
          paddingBottom: 72,
          maxWidth: contentMaxWidth,
          alignSelf: contentMaxWidth ? "center" : undefined,
          width: contentMaxWidth ? "100%" : undefined,
        }}
      >
        {/* Header */}
        <View style={[s.header, setupStacked && s.headerStacked]} {...(Platform.OS === "web" ? { className: "no-print" } as any : {})}>
          <View style={{ flex: 1 }}>
            {!isDesktop && (
              <TouchableOpacity testID="reports-back" onPress={() => router.back()} style={s.backBtn}>
                <Feather name="chevron-left" size={22} color={colors.ink} />
              </TouchableOpacity>
            )}
            <Text style={s.overline}>ANALYTICS · REPORTS</Text>
            <Text style={s.h1}>Reports & Exports</Text>
            <Text style={s.helper}>Choose a report, set the period, then export.</Text>
          </View>

          {isMobile ? (
            <TouchableOpacity
              testID="reports-export-menu"
              onPress={() => setExportMenuOpen(true)}
              style={[s.exportBtn, !canExport && s.exportBtnDisabled]}
              disabled={!canExport}
            >
              <Feather name="download" size={16} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={s.exportRow}>
              <ExportBtn testID="reports-export-xlsx" label="Excel" icon="download" onPress={() => doExport("xlsx")} disabled={!canExport} />
              <ExportBtn testID="reports-export-pdf" label="PDF" icon="file" onPress={() => doExport("pdf")} disabled={!canExport} variant="dark" />
              <ExportBtn testID="reports-print" label="Print" icon="printer" onPress={doPrint} disabled={!canExport} variant="muted" />
            </View>
          )}
        </View>

        {/* Setup bar */}
        <View style={[s.setupBar, setupStacked && s.setupBarStacked]} {...(Platform.OS === "web" ? { className: "no-print" } as any : {})}>
          <SetupField label="Report" flex={2}>
            <TouchableOpacity testID="report-picker" style={s.selectBtn} onPress={() => { setReportSearch(""); setReportPickerOpen(true); }}>
              <Feather name={(mvpMeta?.icon as any) || "file-text"} size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt} numberOfLines={1}>{mvpMeta?.title || "Select report"}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>

          <SetupField label="Entity" flex={1.2}>
            <View style={s.segment}>
              {entityOptions.map((v) => (
                <TouchableOpacity
                  key={v}
                  testID={`inst-${v}`}
                  onPress={() => setInstitution(v as any)}
                  style={[s.segmentItem, institution === v && s.segmentItemActive, entityOptions.length === 1 && { flex: 1 }]}
                >
                  <Text style={[s.segmentTxt, institution === v && s.segmentTxtActive]}>
                    {v === "BOTH" ? "Combined" : v}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </SetupField>

          <SetupField label="Period" flex={1}>
            <TouchableOpacity testID="period-picker" style={s.selectBtn} onPress={() => setPeriodPickerOpen(true)}>
              <Feather name="calendar" size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt}>{periodLabel(periodKind)}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>

          <SetupField label=" " flex={0.9}>
            <TouchableOpacity testID="more-filters" style={s.filtersBtn} onPress={() => setFiltersOpen((o) => !o)}>
              <Feather name="sliders" size={15} color={colors.primary} />
              <Text style={s.filtersBtnTxt}>Filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}</Text>
            </TouchableOpacity>
          </SetupField>

          <SetupField label=" " flex={0.9}>
            <TouchableOpacity
              testID="run-report"
              style={[s.runBtn, (loading || customRangeIncomplete) && s.runBtnDisabled]}
              onPress={runReport}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="play" size={15} color="#fff" />
              )}
              <Text style={s.runBtnTxt}>{loading ? "Running…" : "Run report"}</Text>
            </TouchableOpacity>
          </SetupField>
        </View>

        {/* Advanced filters — desktop inline panel */}
        {filtersOpen && !isMobile && (
          <AdvancedFiltersPanel
            showAcademic={showAcademic}
            showSports={showSports}
            showFinance={showFinance}
            showAttendance={showAttendance}
            periodKind={periodKind}
            customFrom={customFrom}
            customTo={customTo}
            setCustomFrom={setCustomFrom}
            setCustomTo={setCustomTo}
            centre={centre} setCentre={setCentre}
            sport={sport} setSport={setSport}
            grade={grade} setGrade={setGrade}
            sectionId={sectionId} setSectionId={setSectionId}
            status={status} setStatus={setStatus}
            paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
            sections={sections}
            onClose={() => setFiltersOpen(false)}
          />
        )}

        {/* Active filter chips */}
        <View style={s.chipBar} {...(Platform.OS === "web" ? { className: "no-print" } as any : {})}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipBarInner}>
            <View style={s.activeChipStatic}>
              <Text style={s.activeChipTxt}>Entity: {entityLabel(institution)}</Text>
            </View>
            {activeChips.filter((c) => c.key !== "entity").map((chip) => (
              <TouchableOpacity key={chip.key} style={s.activeChip} onPress={chip.onRemove}>
                <Text style={s.activeChipTxt}>{chip.label}</Text>
                <Feather name="x" size={12} color={colors.primary} />
              </TouchableOpacity>
            ))}
            {advancedFilterCount > 0 && (
              <TouchableOpacity testID="clear-filters" onPress={clearAllFilters} style={s.clearAll}>
                <Text style={s.clearAllTxt}>Clear all</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {periodKind === "custom" && customFrom && customTo ? (
            <Text style={s.rangeHint}>{formatDate(range.from)} → {formatDate(range.to)}</Text>
          ) : periodKind !== "custom" ? (
            <Text style={s.rangeHint}>{formatDate(range.from)} → {formatDate(range.to)}</Text>
          ) : null}
        </View>

        {/* Report area */}
        {!showPreview ? (
          <ReadyStatusCard reportTitle={mvpMeta?.title || "—"} runState={runState} />
        ) : (
          <View style={s.previewCard} nativeID="report-print-area" ref={printRef}>
            {runState === "outdated" && (
              <View style={s.outdatedBanner} {...(Platform.OS === "web" ? { className: "no-print" } as any : {})}>
                <Feather name="alert-circle" size={14} color="#B45309" />
                <Text style={s.outdatedTxt}>Filters changed — run the report again to refresh results before exporting.</Text>
                <TouchableOpacity testID="run-report-refresh" style={s.outdatedRun} onPress={runReport}>
                  <Text style={s.outdatedRunTxt}>Run report</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={s.previewHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.previewTitle}>{data?.title || mvpMeta?.title || "Report preview"}</Text>
                <Text style={s.previewSub}>
                  {entityLabel(institution)} · {formatDate(range.from)} → {formatDate(range.to)}
                  {data?.summary?.total_rows != null ? ` · ${data.summary.total_rows} rows` : ""}
                </Text>
              </View>
              {lastLoadedAt && (runState === "ready" || runState === "outdated") && (
                <Text style={s.lastUpdated}>Last updated {formatDateTime(lastLoadedAt)}</Text>
              )}
            </View>

            {runState === "loading" ? (
              <LoadingState message="Generating report…" />
            ) : runState === "error" ? (
              <ErrorState message={error} onRetry={runReport} compact />
            ) : (
              <MvpReportView data={data} />
            )}
          </View>
        )}
      </ScrollView>

      {/* Report picker modal */}
      <PickerModal visible={reportPickerOpen} onClose={() => setReportPickerOpen(false)} title="Select report">
        <TextInput
          testID="report-search"
          value={reportSearch}
          onChangeText={setReportSearch}
          placeholder="Search reports…"
          placeholderTextColor={colors.hint}
          style={s.searchInput}
        />
        <ScrollView style={{ maxHeight: 420 }}>
          {CATEGORIES.map((cat) => {
            const items = filteredReports.filter((r) => r.category === cat);
            if (items.length === 0) return null;
            return (
              <View key={cat}>
                <Text style={s.pickerGroup}>{cat}</Text>
                {items.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    testID={`report-${r.id}`}
                    style={[s.pickerRow, mvpReportId === r.id && s.pickerRowActive]}
                    onPress={() => { setMvpReportId(r.id); setReportPickerOpen(false); }}
                  >
                    <Feather name={r.icon as any} size={16} color={mvpReportId === r.id ? colors.primary : colors.muted2} />
                    <Text style={[s.pickerRowTxt, mvpReportId === r.id && s.pickerRowTxtActive]}>{r.title}</Text>
                    {mvpReportId === r.id && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </PickerModal>

      {/* Period picker modal */}
      <PickerModal visible={periodPickerOpen} onClose={() => setPeriodPickerOpen(false)} title="Select period">
        {PERIOD_OPTIONS.map((p) => (
          <TouchableOpacity
            key={p.key}
            testID={`date-${p.key}`}
            style={[s.pickerRow, periodKind === p.key && s.pickerRowActive]}
            onPress={() => {
              setPeriodKind(p.key);
              setPeriodPickerOpen(false);
              if (p.key === "custom") setFiltersOpen(true);
            }}
          >
            <Text style={[s.pickerRowTxt, periodKind === p.key && s.pickerRowTxtActive]}>{p.label}</Text>
            {periodKind === p.key && <Feather name="check" size={16} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </PickerModal>

      {/* Mobile filters bottom sheet */}
      <PickerModal
        visible={filtersOpen && isMobile}
        onClose={() => setFiltersOpen(false)}
        title="Advanced filters"
        sheet
      >
        <AdvancedFiltersPanel
          showAcademic={showAcademic}
          showSports={showSports}
          showFinance={showFinance}
          showAttendance={showAttendance}
          periodKind={periodKind}
          customFrom={customFrom}
          customTo={customTo}
          setCustomFrom={setCustomFrom}
          setCustomTo={setCustomTo}
          centre={centre} setCentre={setCentre}
          sport={sport} setSport={setSport}
          grade={grade} setGrade={setGrade}
          sectionId={sectionId} setSectionId={setSectionId}
          status={status} setStatus={setStatus}
          paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
          sections={sections}
          embedded
        />
      </PickerModal>

      {/* Mobile export menu */}
      <PickerModal visible={exportMenuOpen} onClose={() => setExportMenuOpen(false)} title="Export" sheet>
        <TouchableOpacity style={s.pickerRow} onPress={() => doExport("xlsx")} disabled={!canExport}>
          <Feather name="download" size={16} color={colors.primary} />
          <Text style={s.pickerRowTxt}>Download Excel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.pickerRow} onPress={() => doExport("pdf")} disabled={!canExport}>
          <Feather name="file" size={16} color={colors.primary} />
          <Text style={s.pickerRowTxt}>Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.pickerRow} onPress={doPrint} disabled={!canExport}>
          <Feather name="printer" size={16} color={colors.primary} />
          <Text style={s.pickerRowTxt}>Print</Text>
        </TouchableOpacity>
      </PickerModal>
    </SafeAreaView>
  );
}

function ReadyStatusCard({ reportTitle, runState }: { reportTitle: string; runState: RunState }) {
  const statusRight = runState === "outdated" ? "Outdated" : "Ready to run";
  const statusColor = runState === "outdated" ? "#B45309" : colors.primary;

  return (
    <View style={s.readyCard} testID="report-ready-card">
      <View style={s.readyCol}>
        <Text style={s.readyLabel}>Selected report</Text>
        <Text style={s.readyValue}>{reportTitle}</Text>
      </View>
      <View style={[s.readyCol, s.readyColMid]}>
        <Text style={s.readyHint}>Choose filters, then run the report.</Text>
      </View>
      <View style={s.readyCol}>
        <Text style={[s.readyStatus, { color: statusColor }]}>{statusRight}</Text>
      </View>
    </View>
  );
}

function SetupField({ label, flex, children }: { label: string; flex?: number; children: React.ReactNode }) {
  return (
    <View style={{ flex: flex ?? 1, minWidth: 140 }}>
      {label.trim() ? <Text style={s.fieldLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

function ExportBtn({ label, icon, onPress, disabled, variant, testID }: {
  label: string; icon: any; onPress: () => void; disabled?: boolean; variant?: "primary" | "dark" | "muted"; testID?: string;
}) {
  const bg = variant === "dark" ? colors.ink : variant === "muted" ? colors.muted : colors.primary;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[s.exportBtn, { backgroundColor: bg }, disabled && s.exportBtnDisabled]}
    >
      <Feather name={icon} size={14} color="#fff" />
      <Text style={s.exportBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function PickerModal({ visible, onClose, title, children, sheet }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode; sheet?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={[s.modalCard, sheet && s.modalSheet]} onPress={(e) => e.stopPropagation?.()}>
          <View style={s.modalHead}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FilterSelect({ label, value, options, onChange, testID }: {
  label: string; value: string; options: readonly string[]; onChange: (v: string) => void; testID?: string;
}) {
  return (
    <View style={s.filterField}>
      <Text style={s.filterFieldLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.miniSelectRow}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              testID={testID ? `${testID}-${opt}` : undefined}
              onPress={() => onChange(opt)}
              style={[s.miniSelect, value === opt && s.miniSelectActive]}
            >
              <Text style={[s.miniSelectTxt, value === opt && s.miniSelectTxtActive]}>
                {opt === "All" ? "All" : opt.replace(/_/g, " ")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function AdvancedFiltersPanel(props: {
  showAcademic: boolean; showSports: boolean; showFinance: boolean; showAttendance: boolean;
  periodKind: PeriodKind; customFrom: string; customTo: string;
  setCustomFrom: (v: string) => void; setCustomTo: (v: string) => void;
  centre: string; setCentre: (v: string) => void;
  sport: string; setSport: (v: string) => void;
  grade: string; setGrade: (v: string) => void;
  sectionId: string; setSectionId: (v: string) => void;
  status: string; setStatus: (v: string) => void;
  paymentMethod: string; setPaymentMethod: (v: string) => void;
  sections: { id: string; label: string }[];
  onClose?: () => void; embedded?: boolean;
}) {
  const {
    showAcademic, showSports, showFinance, showAttendance,
    periodKind, customFrom, customTo, setCustomFrom, setCustomTo,
    centre, setCentre, sport, setSport, grade, setGrade,
    sectionId, setSectionId, status, setStatus, paymentMethod, setPaymentMethod,
    sections, onClose, embedded,
  } = props;

  const sectionOptions = ["All", ...sections.map((x) => x.label)];

  return (
    <View style={[s.advPanel, embedded && { borderWidth: 0, marginBottom: 0, padding: 0 }]}>
      {!embedded && (
        <View style={s.advPanelHead}>
          <Text style={s.advPanelTitle}>Advanced filters</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={18} color={colors.muted2} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {periodKind === "custom" && (
        <View style={s.filterGroup}>
          <Text style={s.filterGroupTitle}>Custom period</Text>
          <View style={s.dateRow}>
            <TextInput testID="date-from" placeholder={`From ${DATE_PLACEHOLDER}`} value={customFrom} onChangeText={setCustomFrom} style={s.dateInput} placeholderTextColor={colors.hint} />
            <TextInput testID="date-to" placeholder={`To ${DATE_PLACEHOLDER}`} value={customTo} onChangeText={setCustomTo} style={s.dateInput} placeholderTextColor={colors.hint} />
          </View>
        </View>
      )}

      {showAcademic && (
        <View style={s.filterGroup}>
          <Text style={s.filterGroupTitle}>People & Academic</Text>
          <FilterSelect label="Grade" value={grade} options={GRADES} onChange={setGrade} testID="grade" />
          {sections.length > 0 && (
            <FilterSelect
              label="Section"
              value={sectionId ? (sections.find((x) => x.id === sectionId)?.label || "All") : "All"}
              options={sectionOptions}
              onChange={(v) => {
                if (v === "All") setSectionId("");
                else {
                  const sec = sections.find((x) => x.label === v);
                  setSectionId(sec?.id || "");
                }
              }}
              testID="section"
            />
          )}
        </View>
      )}

      {showSports && (
        <View style={s.filterGroup}>
          <Text style={s.filterGroupTitle}>Sports</Text>
          <FilterSelect label="Centre" value={centre} options={CENTRES} onChange={setCentre} testID="centre" />
          <FilterSelect label="Sport" value={sport} options={SPORTS} onChange={setSport} testID="sport" />
        </View>
      )}

          {showFinance && !showAttendance && (
        <View style={s.filterGroup}>
          <Text style={s.filterGroupTitle}>Finance</Text>
          <FilterSelect label="Invoice status" value={status} options={INVOICE_STATUSES} onChange={setStatus} testID="status" />
          <FilterSelect label="Payment method" value={paymentMethod} options={PAYMENT_METHODS} onChange={setPaymentMethod} testID="payment-method" />
        </View>
      )}

      {showAttendance && (
        <View style={s.filterGroup}>
          <Text style={s.filterGroupTitle}>Attendance</Text>
          <FilterSelect label="Status" value={status} options={ATTENDANCE_STATUSES} onChange={setStatus} testID="att-status" />
        </View>
      )}
    </View>
  );
}

function MvpReportView({ data }: { data: any }) {
  if (!data) return <EmptyState icon="bar-chart-2" title="No report loaded" message="Select a report and period to preview results here." />;
  const cols: string[] = data.columns || [];
  const rows: any[] = data.rows || [];
  const keys: string[] = data.row_keys || (rows[0] ? Object.keys(rows[0]) : []);
  const summary = data.summary || {};

  return (
    <View style={{ gap: spacing.md }}>
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
          {summary.total_rows != null && <KPI label="Total rows" value={String(summary.total_rows)} tint={colors.primary} icon="list" />}
        </View>
      )}
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
    </View>
  );
}

function KPI({ label, value, tint, icon, testID }: { label: string; value: string; tint: string; icon: any; testID?: string }) {
  return (
    <View style={[s.kpi, { borderLeftColor: tint }]} testID={testID}>
      <View style={[s.kpiIcon, { backgroundColor: `${tint}22` }]}>
        <Feather name={icon} size={16} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.kpiLabel}>{label}</Text>
        <Text style={s.kpiValue}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  deniedBtn: { marginTop: 16, alignSelf: "flex-start", backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.md },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  headerStacked: { flexDirection: "column" },
  backBtn: { padding: 6, borderRadius: radii.sm, backgroundColor: colors.primarySofter, marginBottom: spacing.sm, alignSelf: "flex-start" },
  overline: { fontSize: 10, color: colors.primary, fontWeight: "800", letterSpacing: 0.8 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 2 },
  helper: { fontSize: 13, color: colors.muted2, marginTop: 4, lineHeight: 18 },
  exportRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "flex-start" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.md },
  exportBtnDisabled: { opacity: 0.45 },
  exportBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.3 },

  setupBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({ web: { boxShadow: "0 1px 3px rgba(15,23,42,0.06)" } as any, default: {} }),
  },
  setupBarStacked: { flexDirection: "column", alignItems: "stretch" },
  fieldLabel: { fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  selectBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42,
  },
  selectBtnTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink },
  segment: { flexDirection: "row", backgroundColor: colors.surface2, borderRadius: radii.md, padding: 3, borderWidth: 1, borderColor: colors.border },
  segmentItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: radii.sm, alignItems: "center" },
  segmentItemActive: { backgroundColor: colors.primary, },
  segmentTxt: { fontSize: 11, fontWeight: "800", color: colors.muted },
  segmentTxtActive: { color: "#fff" },
  filtersBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: radii.md,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, backgroundColor: colors.primarySofter,
  },
  filtersBtnTxt: { fontSize: 12, fontWeight: "800", color: colors.primary },
  runBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 42,
  },
  runBtnDisabled: { opacity: 0.55 },
  runBtnTxt: { fontSize: 12, fontWeight: "800", color: "#fff" },

  readyCard: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md,
    backgroundColor: colors.surface2, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  readyCol: { flex: 1, minWidth: 140 },
  readyColMid: { flex: 1.4, minWidth: 180 },
  readyLabel: { fontSize: 10, fontWeight: "700", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.4 },
  readyValue: { fontSize: 14, fontWeight: "800", color: colors.ink, marginTop: 2 },
  readyHint: { fontSize: 13, color: colors.muted2, lineHeight: 18 },
  readyStatus: { fontSize: 12, fontWeight: "800", textAlign: "right" },

  outdatedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap",
    backgroundColor: "#FEF3C7", borderRadius: radii.sm, padding: 10, marginBottom: spacing.md,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  outdatedTxt: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600", minWidth: 200 },
  outdatedRun: { backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm },
  outdatedRunTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },

  advPanel: {
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  advPanelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  advPanelTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  filterGroup: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  filterGroupTitle: { fontSize: 11, fontWeight: "800", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: spacing.sm },
  filterField: { marginBottom: spacing.sm },
  filterFieldLabel: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 6 },
  miniSelectRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  miniSelect: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  miniSelectActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  miniSelectTxt: { fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "capitalize" },
  miniSelectTxtActive: { color: "#fff" },
  dateRow: { flexDirection: "row", gap: 8 },
  dateInput: { flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: 10, fontSize: 13, backgroundColor: colors.surface },

  chipBar: { marginBottom: spacing.md },
  chipBarInner: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  activeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primarySofter, borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.primarySoft,
  },
  activeChipStatic: {
    backgroundColor: colors.surface2, borderRadius: radii.pill,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border,
  },
  activeChipTxt: { fontSize: 11, fontWeight: "700", color: colors.primary },
  clearAll: { paddingHorizontal: 8, paddingVertical: 5 },
  clearAllTxt: { fontSize: 11, fontWeight: "800", color: colors.muted2, textDecorationLine: "underline" },
  rangeHint: { fontSize: 11, color: colors.hint, marginTop: 4, marginLeft: 2 },

  previewCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, minHeight: 280,
    ...Platform.select({ web: { boxShadow: "0 2px 8px rgba(15,23,42,0.04)" } as any, default: {} }),
  },
  previewHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  previewTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  previewSub: { fontSize: 12, color: colors.muted2, marginTop: 4, lineHeight: 16 },
  lastUpdated: { fontSize: 10, color: colors.hint, fontWeight: "600", textAlign: "right", maxWidth: 140 },

  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { flex: 1, minWidth: 160, flexDirection: "row", gap: 10, backgroundColor: colors.surface2, padding: 12, borderRadius: radii.md, borderLeftWidth: 4, borderWidth: 1, borderColor: colors.border },
  kpiIcon: { width: 34, height: 34, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  kpiLabel: { fontSize: 10, color: colors.muted2, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 17, color: colors.ink, fontWeight: "800", marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, maxWidth: 480, alignSelf: "center", width: "100%" },
  modalSheet: { alignSelf: "stretch", marginTop: "auto" as any, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, maxWidth: "100%" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  searchInput: {
    height: 42, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: 12, marginBottom: spacing.sm, fontSize: 14, backgroundColor: colors.surface2,
  },
  pickerGroup: { fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm, marginBottom: 4 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: radii.sm },
  pickerRowActive: { backgroundColor: colors.primarySofter },
  pickerRowTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  pickerRowTxtActive: { color: colors.primary, fontWeight: "800" },
});

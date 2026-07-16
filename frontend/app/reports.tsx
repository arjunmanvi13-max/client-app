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
import {
  classGroupPrefix,
  resolveSectionMatch,
} from "../src/StudentRosterFormFields";
import {
  type AdvancedFilterState,
  type ReportId,
  DEFAULT_ADVANCED_FILTERS,
  countActiveAdvancedFilters,
  activeFilterChips,
  isPwsOnlyReportBlocked,
  resolveReportFilterFields,
} from "../src/reports/reportFilters";
import { ReportAdvancedFiltersPanel } from "../src/reports/ReportAdvancedFiltersPanel";

type RunState = "idle" | "loading" | "ready" | "outdated" | "error";
type PeriodKind = "this_month" | "last_month" | "ytd" | "this_quarter" | "this_year" | "custom";

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

const CATEGORIES = ["Finance", "People", "Academic", "Attendance"] as const;
const PERIOD_OPTIONS: { key: PeriodKind; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "ytd", label: "Year to date" },
  { key: "this_quarter", label: "This quarter" },
  { key: "this_year", label: "This year" },
  { key: "custom", label: "Custom range" },
];

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
  if (kind === "ytd" || kind === "this_year") {
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

  const [mvpReportId, setMvpReportId] = useState<ReportId>(isSportsAdmin ? "players" : "students");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [institution, setInstitution] = useState<"BOTH" | "ALPHA" | "PWS">(isSportsAdmin ? "ALPHA" : isPwsAdmin ? "PWS" : "BOTH");

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>(DEFAULT_ADVANCED_FILTERS);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);

  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [entityPickerOpen, setEntityPickerOpen] = useState(false);
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
    advancedFilters,
  }), [mvpReportId, institution, periodKind, customFrom, customTo, range.from, range.to, advancedFilters]);

  const entityOptions = useMemo(() => {
    if (isSportsAdmin) return ["ALPHA"] as const;
    if (canPickEntity) return ["BOTH", "PWS", "ALPHA"] as const;
    return ["PWS"] as const;
  }, [isSportsAdmin, canPickEntity]);

  const entityDropdownOptions = useMemo(
    () => entityOptions.map((v) => ({ value: v, label: entityLabel(v) })),
    [entityOptions],
  );

  const canChangeEntity = entityOptions.length > 1;

  const onFilterChange = useCallback(<K extends keyof AdvancedFilterState>(key: K, value: AdvancedFilterState[K]) => {
    setAdvancedFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "pwsClass" && value === "All") next.sectionLetter = "All";
      return next;
    });
    if (runState === "ready") setRunState("outdated");
  }, [runState]);

  const advancedFilterCount = useMemo(
    () => countActiveAdvancedFilters(mvpReportId, institution, advancedFilters, periodKind, customFrom, customTo),
    [mvpReportId, institution, advancedFilters, periodKind, customFrom, customTo],
  );

  const activeChips = useMemo(
    () => activeFilterChips(mvpReportId, institution, advancedFilters, periodKind, customFrom, customTo, (k) => periodLabel(k as PeriodKind)),
    [mvpReportId, institution, advancedFilters, periodKind, customFrom, customTo],
  );

  const canExport = runState === "ready" && !!data && !!exportParams && !loading;
  const showPreview = runState === "loading" || runState === "ready" || runState === "outdated" || runState === "error";
  const customRangeIncomplete = periodKind === "custom" && (!range.from || !range.to);

  const buildMvpParams = useCallback(() => {
    const activeKeys = new Set(
      resolveReportFilterFields(mvpReportId, institution, advancedFilters).map((f) => f.stateKey),
    );
    const f = advancedFilters;
    const p: Record<string, string> = { entity: entityParam(institution) };
    if (range.from) p.date_from = range.from;
    if (range.to) p.date_to = range.to;
    if (activeKeys.has("centre") && f.centre !== "All") p.centre = f.centre;
    if (activeKeys.has("sport") && f.sport !== "All") p.sport = f.sport;
    if (activeKeys.has("playerCategory") && f.playerCategory !== "All") p.player_type = f.playerCategory;
    if (activeKeys.has("pwsClass") && f.pwsClass !== "All") {
      if (activeKeys.has("sectionLetter") && f.sectionLetter !== "All") {
        const { id } = resolveSectionMatch(f.pwsClass, f.sectionLetter, sections);
        if (id) p.section_id = id;
        else p.grade = classGroupPrefix(f.pwsClass);
      } else {
        p.grade = classGroupPrefix(f.pwsClass);
      }
    }
    if (activeKeys.has("status") && f.status !== "All") p.status = f.status;
    if (activeKeys.has("paymentMethod") && f.paymentMethod !== "All") p.payment_method = f.paymentMethod;
    if (activeKeys.has("feeCollectionType")) p.fee_collection_type = f.feeCollectionType;
    if (activeKeys.has("pwsStudentType") && f.pwsStudentType !== "All") p.pws_student_type = f.pwsStudentType;
    if (activeKeys.has("department") && f.department !== "All") p.department = f.department;
    if (activeKeys.has("designation") && f.designation !== "All") p.designation = f.designation;
    if (activeKeys.has("employmentType") && f.employmentType !== "All") p.employment_type = f.employmentType;
    if (activeKeys.has("shift") && f.shift !== "All") p.shift = f.shift;
    return p;
  }, [institution, range, advancedFilters, sections, mvpReportId]);

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
    if (advancedFilters.pwsClass === "All" && advancedFilters.sectionLetter !== "All") {
      setAdvancedFilters((prev) => ({ ...prev, sectionLetter: "All" }));
    }
  }, [advancedFilters.pwsClass, advancedFilters.sectionLetter]);

  useEffect(() => {
    if (isPwsOnlyReportBlocked(mvpReportId, institution)) {
      setMvpReportId("players");
    }
  }, [institution, mvpReportId]);

  useEffect(() => {
    if (mvpReportId === "fee-collection") setFiltersOpen(true);
  }, [mvpReportId]);

  useEffect(() => {
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
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
    setAdvancedFilters(DEFAULT_ADVANCED_FILTERS);
    setPeriodKind("this_month");
    setCustomFrom("");
    setCustomTo("");
    if (runState === "ready") setRunState("outdated");
  };

  const removeFilterChip = (chip: typeof activeChips[number]) => {
    if (chip.resetKey === "period") {
      setPeriodKind("this_month");
      setCustomFrom("");
      setCustomTo("");
      return;
    }
    onFilterChange(chip.resetKey, (chip.resetValue || "All") as AdvancedFilterState[typeof chip.resetKey]);
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

          <View style={s.headerActions}>
            {!isMobile && (
              <View style={s.exportRow}>
                <ExportBtn testID="reports-export-xlsx" label="Excel" icon="download" onPress={() => doExport("xlsx")} disabled={!canExport} variant="muted" />
                <ExportBtn testID="reports-export-pdf" label="PDF" icon="file" onPress={() => doExport("pdf")} disabled={!canExport} variant="dark" />
                <ExportBtn testID="reports-print" label="Print" icon="printer" onPress={doPrint} disabled={!canExport} variant="muted" />
              </View>
            )}
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
            {isMobile && (
              <TouchableOpacity
                testID="reports-export-menu"
                onPress={() => setExportMenuOpen(true)}
                style={[s.exportBtn, !canExport && s.exportBtnDisabled]}
                disabled={!canExport}
              >
                <Feather name="download" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Setup bar */}
        <View style={[s.setupCard, setupStacked && s.setupBarStacked]} {...(Platform.OS === "web" ? { className: "no-print" } as any : {})}>
          <View style={[s.setupGrid, setupStacked && s.setupGridStacked]}>
          <SetupField label="Report" flex={1}>
            <TouchableOpacity testID="report-picker" style={s.selectBtn} onPress={() => { setReportSearch(""); setReportPickerOpen(true); }}>
              <Feather name={(mvpMeta?.icon as any) || "file-text"} size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt} numberOfLines={1}>{mvpMeta?.title || "Select report"}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>

          <SetupField label="Entity" flex={1}>
            <TouchableOpacity
              testID="entity-picker"
              style={[s.selectBtn, !canChangeEntity && s.selectBtnDisabled]}
              onPress={() => canChangeEntity && setEntityPickerOpen(true)}
              disabled={!canChangeEntity}
            >
              <Feather name="layers" size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt} numberOfLines={1}>{entityLabel(institution)}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>

          <SetupField label="Period" flex={1}>
            <TouchableOpacity testID="period-picker" style={s.selectBtn} onPress={() => setPeriodPickerOpen(true)}>
              <Feather name="calendar" size={15} color={colors.primary} />
              <Text style={s.selectBtnTxt}>{periodLabel(periodKind)}</Text>
              <Feather name="chevron-down" size={16} color={colors.muted2} />
            </TouchableOpacity>
          </SetupField>

          <SetupField label=" " flex={0.8}>
            <TouchableOpacity testID="more-filters" style={s.filtersBtn} onPress={() => setFiltersOpen((o) => !o)}>
              <Feather name="sliders" size={15} color={colors.primary} />
              <Text style={s.filtersBtnTxt}>Filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ""}</Text>
            </TouchableOpacity>
          </SetupField>
          </View>

          {periodKind === "custom" && (
            <View style={s.inlineDateRow}>
              <TextInput testID="date-from-inline" placeholder={`From ${DATE_PLACEHOLDER}`} value={customFrom} onChangeText={setCustomFrom} style={s.dateInput} placeholderTextColor={colors.hint} />
              <TextInput testID="date-to-inline" placeholder={`To ${DATE_PLACEHOLDER}`} value={customTo} onChangeText={setCustomTo} style={s.dateInput} placeholderTextColor={colors.hint} />
            </View>
          )}
        </View>

        {/* Advanced filters — desktop inline panel */}
        {filtersOpen && !isMobile && (
          <ReportAdvancedFiltersPanel
            reportId={mvpReportId}
            entity={institution}
            filters={advancedFilters}
            onFilterChange={onFilterChange}
            periodKind={periodKind}
            customFrom={customFrom}
            customTo={customTo}
            setCustomFrom={setCustomFrom}
            setCustomTo={setCustomTo}
            onClose={() => setFiltersOpen(false)}
          />
        )}

        {/* Active filter chips */}
        <View style={s.chipBar} {...(Platform.OS === "web" ? { className: "no-print" } as any : {})}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipBarInner}>
            <View style={s.activeChipStatic}>
              <Text style={s.activeChipTxt}>Entity: {entityLabel(institution)}</Text>
            </View>
            {activeChips.map((chip) => (
              <TouchableOpacity key={chip.key} style={s.activeChip} onPress={() => removeFilterChip(chip)}>
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

      {/* Entity picker modal */}
      <PickerModal visible={entityPickerOpen} onClose={() => setEntityPickerOpen(false)} title="Select entity">
        {entityDropdownOptions.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            testID={`inst-${opt.value}`}
            style={[s.pickerRow, institution === opt.value && s.pickerRowActive]}
            onPress={() => {
              setInstitution(opt.value as "BOTH" | "ALPHA" | "PWS");
              setEntityPickerOpen(false);
            }}
          >
            <Feather name="layers" size={16} color={institution === opt.value ? colors.primary : colors.muted2} />
            <Text style={[s.pickerRowTxt, institution === opt.value && s.pickerRowTxtActive]}>{opt.label}</Text>
            {institution === opt.value && <Feather name="check" size={16} color={colors.primary} />}
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
        <ReportAdvancedFiltersPanel
          reportId={mvpReportId}
          entity={institution}
          filters={advancedFilters}
          onFilterChange={onFilterChange}
          periodKind={periodKind}
          customFrom={customFrom}
          customTo={customTo}
          setCustomFrom={setCustomFrom}
          setCustomTo={setCustomTo}
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
    <View style={{ flex: flex ?? 1, minWidth: 160, flexGrow: 1 }}>
      {label.trim() ? <Text style={s.fieldLabel}>{label}</Text> : null}
      {children}
    </View>
  );
}

function ExportBtn({ label, icon, onPress, disabled, variant, testID }: {
  label: string; icon: any; onPress: () => void; disabled?: boolean; variant?: "primary" | "dark" | "muted"; testID?: string;
}) {
  const bg = variant === "dark" ? "#0F172A" : variant === "muted" ? colors.surface : colors.primary;
  const border = variant === "muted" ? colors.border : "transparent";
  const textColor = variant === "muted" ? colors.ink : "#fff";
  const iconColor = variant === "muted" ? colors.muted2 : "#fff";
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[s.exportBtn, { backgroundColor: bg, borderWidth: variant === "muted" ? 1 : 0, borderColor: border }, disabled && s.exportBtnDisabled]}
    >
      <Feather name={icon} size={14} color={iconColor} />
      <Text style={[s.exportBtnTxt, { color: textColor }]}>{label}</Text>
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
          {summary.total_outstanding != null && <KPI label="Total Outstanding" value={inr(summary.total_outstanding)} tint="#EA580C" icon="alert-triangle" />}
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
  wrap: { flex: 1, backgroundColor: "#F8FAFC" },
  deniedBtn: { marginTop: 16, alignSelf: "flex-start", backgroundColor: colors.ink, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.md },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.lg },
  headerStacked: { flexDirection: "column" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap", justifyContent: "flex-end" },
  backBtn: { padding: 6, borderRadius: radii.sm, backgroundColor: colors.primarySofter, marginBottom: spacing.sm, alignSelf: "flex-start" },
  overline: { fontSize: 10, color: colors.primary, fontWeight: "800", letterSpacing: 0.8 },
  h1: { fontSize: 26, fontWeight: "800", color: "#0F172A", marginTop: 2, letterSpacing: -0.3 },
  helper: { fontSize: 13, color: "#64748B", marginTop: 4, lineHeight: 18 },
  exportRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radii.md },
  exportBtnDisabled: { opacity: 0.45 },
  exportBtnTxt: { fontWeight: "700", fontSize: 12, letterSpacing: 0.2 },

  setupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...Platform.select({ web: { boxShadow: "0 1px 3px rgba(15,23,42,0.05)" } as any, default: {} }),
  },
  setupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  setupGridStacked: { flexDirection: "column", alignItems: "stretch" },
  setupBarStacked: {},
  inlineDateRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  fieldLabel: { fontSize: 10, fontWeight: "800", color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 42,
  },
  selectBtnDisabled: { opacity: 0.85 },
  selectBtnTxt: { flex: 1, fontSize: 13, fontWeight: "600", color: "#0F172A" },
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
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: "#F1F5F9",
    ...Platform.select({ web: { boxShadow: "0 1px 3px rgba(15,23,42,0.05)" } as any, default: {} }),
  },
  advPanelEmbedded: { borderWidth: 0, marginBottom: 0, padding: 0, shadowOpacity: 0 },
  advPanelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  advPanelTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  filterGroup: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  filterGroupFirst: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  filterGroupTitle: { fontSize: 11, fontWeight: "800", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: spacing.sm },
  filterHint: { fontSize: 12, color: colors.muted2, marginBottom: spacing.sm, fontStyle: "italic" },
  filterField: { marginBottom: spacing.sm },
  filterFieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 6 },
  academicFilterGrid: { gap: spacing.md },
  academicFilterGridWide: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  miniSelectRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  miniSelect: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
  miniSelectHover: Platform.select({ web: { backgroundColor: "#F1F5F9" } as object, default: {} }),
  miniSelectActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  miniSelectTxt: { fontSize: 11, fontWeight: "700", color: "#475569", textTransform: "capitalize" },
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
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: "#F1F5F9", minHeight: 280,
    ...Platform.select({ web: { boxShadow: "0 1px 3px rgba(15,23,42,0.05)" } as any, default: {} }),
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

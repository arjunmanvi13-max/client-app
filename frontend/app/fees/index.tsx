import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth, userHasPermission } from "../../src/auth";
import { BusinessEntity, Permission } from "../../src/rbac";
import { formatDate, parseToISO, toISODate } from "../../src/dateFormat";
import { useBreakpoint } from "../../src/useBreakpoint";
import { FinanceReportsFilterPanel } from "../../src/components/fees/FinanceReportsFilterPanel";
import { PastDueReportView } from "../../src/components/fees/reports/PastDueReportView";
import { CollectionsSummaryReportView } from "../../src/components/fees/reports/CollectionsSummaryReportView";
import { RevenueBreakdownReportView } from "../../src/components/fees/reports/RevenueBreakdownReportView";
import { DiscountsReportView } from "../../src/components/fees/reports/DiscountsReportView";
import { ExpenseOutflowReportView } from "../../src/components/fees/reports/ExpenseOutflowReportView";
import {
  clampHistoryRange,
  defaultHistoryRange,
  entityLabel,
  historyMinDate,
  reportViewFromParam,
  reportViewToParam,
  type FinanceCentre,
  type FinanceEntity,
  type PeriodFilter,
  type ReportView,
} from "../../src/fees/financeReportsFilters";
import { exportFinanceReport } from "../../src/fees/financeReportsExport";
import { getExportMatrix, reportViewTitle, useFinanceReportData } from "../../src/fees/useFinanceReports";
import type { FinanceReportFilters } from "../../src/fees/financeReportsTypes";

export default function FinanceReportsScreen() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string | string[] }>();
  const { user } = useAuth();
  const { horizontalPadding } = useBreakpoint();

  const [centre, setCentre] = useState<FinanceCentre>("all");
  const [entity, setEntity] = useState<FinanceEntity>("alpha");
  const [reportView, setReportView] = useState<ReportView>("past_due_aging");
  const [period, setPeriod] = useState<PeriodFilter>("current_month");
  const defaultRange = defaultHistoryRange();
  const [customFrom, setCustomFrom] = useState(() => formatDate(defaultRange.from));
  const [customTo, setCustomTo] = useState(() => formatDate(defaultRange.to));
  const [exporting, setExporting] = useState(false);

  const allowed = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS)
    || userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);
  const canViewPws = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS);
  const canViewAlpha = userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);
  const showEntityFilter = canViewPws && canViewAlpha;
  const showVenue = entity !== "pws";

  useEffect(() => {
    const fromParam = reportViewFromParam(tabParam);
    if (fromParam) setReportView(fromParam);
  }, [tabParam]);

  useEffect(() => {
    if (!showEntityFilter) {
      setEntity(canViewAlpha ? "alpha" : "pws");
    }
  }, [showEntityFilter, canViewAlpha]);

  const historyBounds = useMemo(() => {
    const fromIso = parseToISO(customFrom) || defaultRange.from;
    const toIso = parseToISO(customTo) || defaultRange.to;
    return clampHistoryRange(fromIso, toIso);
  }, [customFrom, customTo, defaultRange.from, defaultRange.to]);

  const filters: FinanceReportFilters = useMemo(() => ({
    centre,
    entity,
    reportView,
    period,
    customFrom: historyBounds.from,
    customTo: historyBounds.to,
  }), [centre, entity, reportView, period, historyBounds.from, historyBounds.to]);

  const { data: reportData, loading, error } = useFinanceReportData(filters);

  const handleReportViewChange = useCallback((view: ReportView) => {
    setReportView(view);
    router.setParams({ tab: reportViewToParam(view) });
  }, [router]);

  const handleExport = useCallback(async (format: "csv" | "xlsx" | "pdf") => {
    setExporting(true);
    try {
      const { columns, rows, summaryRows } = getExportMatrix(filters, reportData);
      await exportFinanceReport({
        title: reportViewTitle(filters.reportView),
        reportView: filters.reportView,
        format,
        filters,
        columns,
        rows,
        summaryRows,
      }, user?.name);
    } finally {
      setExporting(false);
    }
  }, [filters, user?.name, reportData]);

  const entityOverline = entity === "all" ? "PWS & ALPHA" : entityLabel(entity);

  if (!user) return null;
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Finance Reports</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>Fee reports permission required</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="fees-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>FINANCIALS · {entityOverline}</Text>
          <Text style={s.h1}>Finance Reports</Text>
          <Text style={s.sub}>{reportViewTitle(reportView)}</Text>
        </View>
        <TouchableOpacity style={s.collectLink} onPress={() => router.push("/fees/collection")}>
          <Feather name="inbox" size={14} color="#1E40AF" />
          <Text style={s.collectLinkTxt}>Collect Fees</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: horizontalPadding }}>
        <FinanceReportsFilterPanel
          centre={centre}
          onCentre={setCentre}
          showVenue={showVenue}
          entity={entity}
          onEntity={setEntity}
          showEntity={showEntityFilter}
          reportView={reportView}
          onReportView={handleReportViewChange}
          period={period}
          onPeriod={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
          historyMinDate={historyMinDate()}
          historyMaxDate={toISODate()}
          onExport={handleExport}
          exporting={exporting}
        />
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding }]}>
        {loading && (
          <View style={s.stateBox}>
            <ActivityIndicator size="small" color="#1E40AF" />
            <Text style={s.stateText}>Loading report data…</Text>
          </View>
        )}
        {!loading && error && (
          <View style={s.stateBox}>
            <Text style={s.errorText}>{error}</Text>
            <Text style={s.stateHint}>Showing cached sample data until the connection is restored.</Text>
          </View>
        )}
        {!loading && reportView === "past_due_aging" && (
          <PastDueReportView
            data={reportData as any}
            onMarkPaid={() => router.push("/fees/collection")}
          />
        )}
        {!loading && reportView === "collections_summary" && (
          <CollectionsSummaryReportView data={reportData as any} />
        )}
        {!loading && reportView === "revenue_breakdown" && (
          <RevenueBreakdownReportView data={reportData as any} />
        )}
        {!loading && reportView === "expense_outflow" && (
          <ExpenseOutflowReportView data={reportData as any} />
        )}
        {!loading && reportView === "discounts_waivers" && (
          <DiscountsReportView data={reportData as any} />
        )}
        {!loading && reportView === "refunds_cancellations" && (
          <RefundsReportView data={reportData as any} />
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8, marginTop: 4 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  collectLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
  },
  collectLinkTxt: { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  scroll: { paddingTop: 12, paddingBottom: 24 },
  stateBox: { padding: 16, alignItems: "center", gap: 6, marginBottom: 12 },
  stateText: { fontSize: 12, color: "#64748B" },
  stateHint: { fontSize: 11, color: "#94A3B8", textAlign: "center" },
  errorText: { fontSize: 12, fontWeight: "700", color: "#DC2626", textAlign: "center" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
});

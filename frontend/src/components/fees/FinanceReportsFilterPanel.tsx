import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, TouchableOpacity, type View as RNView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../theme";
import { DATE_PLACEHOLDER, formatDate, isValidDisplayDate, parseToISO } from "../../dateFormat";
import type { FinanceCentre, FinanceEntity, PeriodFilter, ReportView } from "../../fees/financeReportsFilters";

type Props = {
  centre: FinanceCentre;
  onCentre: (c: FinanceCentre) => void;
  showVenue: boolean;
  entity: FinanceEntity;
  onEntity: (e: FinanceEntity) => void;
  showEntity: boolean;
  reportView: ReportView;
  onReportView: (v: ReportView) => void;
  period: PeriodFilter;
  onPeriod: (p: PeriodFilter) => void;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  historyMinDate: string;
  historyMaxDate: string;
  onExport: (format: "csv" | "xlsx" | "pdf") => void;
  exporting?: boolean;
};

const CENTRE_OPTIONS = [
  { id: "all", label: "All Centres" },
  { id: "Balua", label: "Balua" },
  { id: "Harding Park", label: "Harding Park" },
];

const ENTITY_OPTIONS = [
  { id: "alpha", label: "ALPHA" },
  { id: "all", label: "Both" },
  { id: "pws", label: "PWS" },
];

const REPORT_OPTIONS = [
  { id: "past_due_aging", label: "Past Due & Aging Receivables" },
  { id: "collections_summary", label: "Fee Collections Summary" },
  { id: "revenue_breakdown", label: "Revenue Breakdown by Line Item" },
  { id: "discounts_waivers", label: "Discounts, Waivers & Concessions" },
  { id: "refunds_cancellations", label: "Refunds & Cancellations" },
];

const PERIOD_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "current_month", label: "Current Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

function FilterDropdown({
  prefix, options, value, onChange, testID,
}: {
  prefix: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<RNView>(null);
  const selectedLabel = options.find((o) => o.id === value)?.label ?? value;

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return;
    const onDocClick = (e: MouseEvent) => {
      const node = rootRef.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (Platform.OS === "web") {
    return (
      <View style={s.dropdownWrap}>
        <View style={s.dropdownBtn}>
          <Text style={s.dropdownPrefix} numberOfLines={1}>{prefix}:</Text>
          <select
            data-testid={testID}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={s.webSelect}
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <Feather name="chevron-down" size={14} color={colors.muted} />
        </View>
      </View>
    );
  }

  return (
    <View ref={rootRef} style={[s.dropdownWrap, { zIndex: open ? 50 : 1 }]}>
      <Pressable testID={testID} onPress={() => setOpen((v) => !v)} style={s.dropdownBtn}>
        <Text style={s.dropdownTxt} numberOfLines={1}>{prefix}: {selectedLabel}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={s.menu}>
          {options.map((opt) => (
            <Pressable
              key={opt.id}
              testID={`${testID}-${opt.id}`}
              onPress={() => { onChange(opt.id); setOpen(false); }}
              style={[s.menuItem, value === opt.id && s.menuItemActive]}
            >
              <Text style={[s.menuTxt, value === opt.id && s.menuTxtActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ExportMenu({ onExport, exporting }: { onExport: (f: "csv" | "xlsx" | "pdf") => void; exporting?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<RNView>(null);

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return;
    const onDocClick = (e: MouseEvent) => {
      const node = rootRef.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <View ref={rootRef} style={[s.exportWrap, { zIndex: open ? 60 : 1 }]}>
      <TouchableOpacity
        testID="finance-export-btn"
        style={s.exportBtn}
        disabled={exporting}
        onPress={() => setOpen((v) => !v)}
      >
        <Feather name="download" size={14} color="#fff" />
        <Text style={s.exportBtnTxt}>{exporting ? "Exporting…" : "Export Report"}</Text>
        <Feather name="chevron-down" size={14} color="#fff" />
      </TouchableOpacity>
      {open && (
        <View style={s.exportMenu}>
          {([
            { id: "csv", label: "Export to CSV" },
            { id: "xlsx", label: "Export to Excel (.xlsx)" },
            { id: "pdf", label: "Export to PDF" },
          ] as const).map((opt) => (
            <Pressable
              key={opt.id}
              testID={`finance-export-${opt.id}`}
              style={s.menuItem}
              onPress={() => { onExport(opt.id); setOpen(false); }}
            >
              <Text style={s.menuTxt}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export function FinanceReportsFilterPanel(props: Props) {
  const {
    centre, onCentre, showVenue,
    entity, onEntity, showEntity,
    reportView, onReportView,
    period, onPeriod,
    customFrom, customTo, onCustomFrom, onCustomTo,
    historyMinDate, historyMaxDate,
    onExport, exporting,
  } = props;

  return (
    <View style={s.card} testID="finance-reports-filters">
      <View style={s.controlRow}>
        <View style={s.dropdownRow}>
          {showVenue && (
            <FilterDropdown
              prefix="Venue"
              testID="fee-centre"
              options={CENTRE_OPTIONS}
              value={centre}
              onChange={(id) => onCentre(id as FinanceCentre)}
            />
          )}
          {showEntity && (
            <FilterDropdown
              prefix="Entity"
              testID="fee-entity"
              options={ENTITY_OPTIONS}
              value={entity}
              onChange={(id) => onEntity(id as FinanceEntity)}
            />
          )}
          <FilterDropdown
            prefix="Report View"
            testID="fee-report"
            options={REPORT_OPTIONS}
            value={reportView}
            onChange={(id) => onReportView(id as ReportView)}
          />
          <FilterDropdown
            prefix="Period"
            testID="fee-period"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(id) => onPeriod(id as PeriodFilter)}
          />
        </View>
        <ExportMenu onExport={onExport} exporting={exporting} />
      </View>

      {period === "custom" && (
        <View style={s.historyBlock}>
          <Text style={s.historyHint}>
            Custom date range · {formatDate(historyMinDate)} – {formatDate(historyMaxDate)}
          </Text>
          <View style={s.historyRow}>
            <View style={s.historyField}>
              <Text style={s.historyLabel}>From ({DATE_PLACEHOLDER})</Text>
              <TextInput
                testID="fee-history-from"
                value={customFrom}
                onChangeText={onCustomFrom}
                onBlur={() => {
                  if (isValidDisplayDate(customFrom)) {
                    onCustomFrom(formatDate(parseToISO(customFrom) || customFrom));
                  }
                }}
                placeholder={DATE_PLACEHOLDER}
                placeholderTextColor={colors.hint}
                style={s.historyInput}
              />
            </View>
            <View style={s.historyField}>
              <Text style={s.historyLabel}>To ({DATE_PLACEHOLDER})</Text>
              <TextInput
                testID="fee-history-to"
                value={customTo}
                onChangeText={onCustomTo}
                onBlur={() => {
                  if (isValidDisplayDate(customTo)) {
                    onCustomTo(formatDate(parseToISO(customTo) || customTo));
                  }
                }}
                placeholder={DATE_PLACEHOLDER}
                placeholderTextColor={colors.hint}
                style={s.historyInput}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "visible",
  },
  controlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    overflow: "visible",
  },
  dropdownRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    overflow: "visible",
  },
  dropdownWrap: { position: "relative", flexShrink: 0, minWidth: 160, flex: 1, maxWidth: 280 },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    minWidth: 160,
  },
  dropdownPrefix: { fontSize: 12, fontWeight: "700", color: colors.muted, flexShrink: 0 },
  dropdownTxt: { fontSize: 12, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  webSelect: {
    flex: 1,
    minWidth: 0,
    borderWidth: 0,
    borderStyle: "solid",
    backgroundColor: "transparent",
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
    outlineStyle: "none",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    padding: 0,
    margin: 0,
  } as object,
  menu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    minWidth: 220,
    zIndex: 100,
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      },
    }),
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  menuItemActive: { backgroundColor: colors.primarySofter },
  menuTxt: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  menuTxtActive: { color: colors.primary, fontWeight: "700" },
  historyBlock: { gap: spacing.sm },
  historyHint: { fontSize: 11, color: colors.hint, lineHeight: 16 },
  historyRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  historyField: { flex: 1, minWidth: 140, gap: 6 },
  historyLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  historyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.surface2,
    outlineStyle: "none" as any,
  },
  exportRow: { flexDirection: "row", justifyContent: "flex-end" },
  exportWrap: { position: "relative" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  exportBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  exportMenu: {
    position: "absolute",
    top: "100%",
    right: 0,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    minWidth: 220,
    zIndex: 120,
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" } as object,
      default: {},
    }),
  },
});

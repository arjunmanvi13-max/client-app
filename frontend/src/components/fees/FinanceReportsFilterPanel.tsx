import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

type AnchorRect = { top: number; left: number; width: number; height: number };

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
  { id: "expense_outflow", label: "Expense & Outflow Summary" },
  { id: "discounts_waivers", label: "Discounts, Waivers & Concessions" },
  { id: "refunds_cancellations", label: "Refunds & Cancellations" },
];

const PERIOD_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "current_month", label: "Current Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
];

const MENU_Z_INDEX = 9999;
/** Matches DOM attribute from `dataSet={{ financeMenuPortal: "true" }}` on react-native-web. */
const MENU_PORTAL_SELECTOR = "[data-finance-menu-portal]";

function renderWebPortal(node: ReactNode) {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPortal } = require("react-dom") as typeof import("react-dom");
  return createPortal(node, document.body);
}

function useAnchoredDropdown() {
  const triggerRef = useRef<RNView>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const measureAnchor = useCallback(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return null;
    const node = triggerRef.current as unknown as HTMLElement | null;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) return false;
      setAnchor(measureAnchor());
      return true;
    });
  }, [measureAnchor]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent) => {
      const node = triggerRef.current as unknown as HTMLElement | null;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (node?.contains(target)) return;
      if (target.closest?.(MENU_PORTAL_SELECTOR)) return;
      close();
    };
    const onReposition = () => setAnchor(measureAnchor());
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const timer = setTimeout(() => {
        document.addEventListener("click", onDocPointer);
      }, 0);
      window.addEventListener("resize", onReposition);
      window.addEventListener("scroll", onReposition, true);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("click", onDocPointer);
        window.removeEventListener("resize", onReposition);
        window.removeEventListener("scroll", onReposition, true);
      };
    }
  }, [open, close, measureAnchor]);

  return { triggerRef, open, anchor, toggle, close, setOpen };
}

function WebMenuPortal({
  anchor,
  align,
  minWidth,
  children,
}: {
  anchor: AnchorRect | null;
  align: "left" | "right";
  minWidth: number;
  children: ReactNode;
}) {
  if (Platform.OS !== "web" || !anchor || typeof document === "undefined") return null;

  const left = align === "right"
    ? Math.max(8, anchor.left + anchor.width - minWidth)
    : anchor.left;

  return renderWebPortal(
    <View
      {...(Platform.OS === "web" ? {
        dataSet: { financeMenuPortal: "true" },
        // Prevent premature close before menu item click handlers run.
        onMouseDown: (e: { stopPropagation?: () => void }) => e.stopPropagation?.(),
      } : {})}
      style={[
        s.portalMenu,
        {
          position: "fixed",
          top: anchor.top,
          left,
          minWidth,
          zIndex: MENU_Z_INDEX,
        } as object,
      ]}
    >
      {children}
    </View>,
  );
}

function MenuItem({
  label,
  active,
  testID,
  onSelect,
}: {
  label: string;
  active?: boolean;
  testID?: string;
  onSelect: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onSelect}
      style={[s.menuItem, active && s.menuItemActive]}
      {...(Platform.OS === "web" ? { role: "menuitem" as const } : {})}
    >
      <Text style={[s.menuTxt, active && s.menuTxtActive]}>{label}</Text>
    </Pressable>
  );
}

function FilterDropdown({
  prefix, options, value, onChange, testID,
}: {
  prefix: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  testID?: string;
}) {
  const { triggerRef, open, anchor, toggle, setOpen } = useAnchoredDropdown();
  const selectedLabel = options.find((o) => o.id === value)?.label ?? value;
  const menuMinWidth = Math.max(220, anchor?.width ?? 220);

  const menu = options.map((opt) => (
    <MenuItem
      key={opt.id}
      testID={`${testID}-${opt.id}`}
      label={opt.label}
      active={value === opt.id}
      onSelect={() => {
        onChange(opt.id);
        setOpen(false);
      }}
    />
  ));

  return (
    <View ref={triggerRef} style={[s.dropdownWrap, open && s.dropdownWrapOpen]}>
      <Pressable
        testID={testID}
        onPress={toggle}
        style={({ pressed }) => [s.dropdownBtn, pressed && s.dropdownBtnPressed, open && s.dropdownBtnOpen]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={s.dropdownPrefix} numberOfLines={1}>{prefix}:</Text>
        <Text style={s.dropdownValue} numberOfLines={1}>{selectedLabel}</Text>
        <View pointerEvents="none">
          <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
        </View>
      </Pressable>
      {open && (
        Platform.OS === "web" ? (
          <WebMenuPortal anchor={anchor} align="left" minWidth={menuMinWidth}>{menu}</WebMenuPortal>
        ) : (
          <View style={s.menu}>{menu}</View>
        )
      )}
    </View>
  );
}

function ExportMenu({ onExport, exporting }: { onExport: (f: "csv" | "xlsx" | "pdf") => void; exporting?: boolean }) {
  const { triggerRef, open, anchor, toggle, close } = useAnchoredDropdown();
  const menuMinWidth = 220;

  const menu = ([
    { id: "csv", label: "Export to CSV" },
    { id: "xlsx", label: "Export to Excel (.xlsx)" },
    { id: "pdf", label: "Export to PDF" },
  ] as const).map((opt) => (
    <MenuItem
      key={opt.id}
      testID={`finance-export-${opt.id}`}
      label={opt.label}
      onSelect={() => {
        close();
        onExport(opt.id);
      }}
    />
  ));

  return (
    <View ref={triggerRef} style={[s.exportWrap, open && s.exportWrapOpen]}>
      <TouchableOpacity
        testID="finance-export-btn"
        style={s.exportBtn}
        disabled={exporting}
        activeOpacity={0.85}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View pointerEvents="none">
          <Feather name="download" size={14} color="#fff" />
        </View>
        <Text style={s.exportBtnTxt}>{exporting ? "Exporting…" : "Export Report"}</Text>
        <View pointerEvents="none">
          <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color="#fff" />
        </View>
      </TouchableOpacity>
      {open && (
        Platform.OS === "web" ? (
          <WebMenuPortal anchor={anchor} align="right" minWidth={menuMinWidth}>{menu}</WebMenuPortal>
        ) : (
          <View style={s.exportMenu}>{menu}</View>
        )
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
        {showEntity && (
          <FilterDropdown
            prefix="Entity"
            testID="fee-entity"
            options={ENTITY_OPTIONS}
            value={entity}
            onChange={(id) => onEntity(id as FinanceEntity)}
          />
        )}
        {showVenue && (
          <FilterDropdown
            prefix="Venue"
            testID="fee-centre"
            options={CENTRE_OPTIONS}
            value={centre}
            onChange={(id) => onCentre(id as FinanceCentre)}
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
    zIndex: 20,
    ...Platform.select({
      web: { isolation: "isolate" } as object,
      default: {},
    }),
  },
  controlRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: spacing.sm,
    overflow: "visible",
  },
  dropdownWrap: {
    position: "relative",
    flexShrink: 0,
    minWidth: 160,
    flex: 1,
    maxWidth: 280,
    zIndex: 1,
  },
  dropdownWrapOpen: {
    zIndex: 50,
  },
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
    ...Platform.select({
      web: { cursor: "pointer", userSelect: "none" } as object,
      default: {},
    }),
  },
  dropdownBtnPressed: { opacity: 0.92 },
  dropdownBtnOpen: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  dropdownPrefix: { fontSize: 12, fontWeight: "700", color: colors.muted, flexShrink: 0 },
  dropdownValue: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: "600", color: colors.ink },
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
    zIndex: MENU_Z_INDEX,
    elevation: 24,
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  portalMenu: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    ...Platform.select({
      web: { boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)" } as object,
      default: {},
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
  exportWrap: {
    position: "relative",
    zIndex: 1,
    flexShrink: 0,
  },
  exportWrapOpen: {
    zIndex: 100,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    ...Platform.select({
      web: { cursor: "pointer", userSelect: "none" } as object,
      default: {},
    }),
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
    zIndex: MENU_Z_INDEX,
    elevation: 24,
    ...Platform.select({
      web: { boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)" } as object,
      default: {},
    }),
  },
});

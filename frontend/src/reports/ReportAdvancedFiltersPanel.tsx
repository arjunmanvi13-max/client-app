import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FormSelect } from "../components/forms/FormSelect";
import { colors, radii, spacing } from "../theme";
import { useBreakpoint } from "../useBreakpoint";
import { DATE_PLACEHOLDER } from "../dateFormat";
import {
  type AdvancedFilterState,
  type EntityScope,
  type ReportId,
  resolveReportFilterFields,
} from "./reportFilters";

type ReportAdvancedFiltersPanelProps = {
  reportId: ReportId;
  entity: EntityScope;
  filters: AdvancedFilterState;
  onFilterChange: <K extends keyof AdvancedFilterState>(key: K, value: AdvancedFilterState[K]) => void;
  periodKind: string;
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
  embedded?: boolean;
  onClose?: () => void;
};

export function ReportAdvancedFiltersPanel({
  reportId,
  entity,
  filters,
  onFilterChange,
  periodKind,
  customFrom,
  customTo,
  setCustomFrom,
  setCustomTo,
  embedded,
  onClose,
}: ReportAdvancedFiltersPanelProps) {
  const { isMobile } = useBreakpoint();

  const fields = useMemo(
    () => resolveReportFilterFields(reportId, entity, filters),
    [reportId, entity, filters],
  );

  const sectionTitle = useMemo(() => {
    if (reportId === "fee-collection") return "Fee collection";
    if (reportId === "staff") return "Staff";
    if (reportId === "players") return "Players";
    if (reportId === "students" || reportId === "marks-summary" || reportId === "report-card-status") return "Academic";
    if (reportId === "attendance-summary" || reportId === "attendance-detail") return "Attendance";
    if (reportId === "outstanding-invoices" || reportId === "payment-receipts") return "Finance";
    return "Filters";
  }, [reportId]);

  const showCustomPeriod = periodKind === "custom" && !embedded;
  const gridWide = !isMobile;

  if (fields.length === 0 && !showCustomPeriod) {
    return (
      <View style={[s.advPanel, embedded && s.advPanelEmbedded]}>
        {!embedded && (
          <View style={s.advPanelHead}>
            <Text style={s.advPanelTitle}>Advanced filters</Text>
            {onClose && (
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Feather name="x" size={18} color={colors.muted2} />
              </TouchableOpacity>
            )}
          </View>
        )}
        <Text style={s.emptyHint}>No additional filters for this report.</Text>
      </View>
    );
  }

  return (
    <View style={[s.advPanel, embedded && s.advPanelEmbedded]}>
      {!embedded && (
        <View style={s.advPanelHead}>
          <Text style={s.advPanelTitle}>Advanced filters</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={colors.muted2} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {fields.length > 0 && (
        <View style={s.filterSection}>
          <Text style={s.filterGroupTitle}>{sectionTitle}</Text>
          <View style={[s.filterGrid, gridWide && s.filterGridWide]}>
            {fields.map((field) => {
              const disabled = field.key === "sectionLetter" && filters.pwsClass === "All";
              const value = filters[field.stateKey];
              return (
                <View key={field.key} style={[s.filterCell, gridWide && s.filterCellHalf]}>
                  <FormSelect
                    label={field.label}
                    compact
                    value={value}
                    options={field.options}
                    onChange={(v) => onFilterChange(field.stateKey, v as AdvancedFilterState[typeof field.stateKey])}
                    disabled={disabled}
                    testID={field.testID}
                  />
                  {field.hint && filters.feeCollectionType === "historical_due" && periodKind !== "custom" ? (
                    <Text style={s.filterHint}>{field.hint}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {showCustomPeriod && (
        <View style={[s.filterSection, fields.length === 0 && s.filterSectionFirst]}>
          <Text style={s.filterGroupTitle}>Custom period</Text>
          <View style={[s.filterGrid, gridWide && s.filterGridWide]}>
            <View style={[s.filterCell, gridWide && s.filterCellHalf]}>
              <Text style={s.inlineLabel}>From</Text>
              <TextInput
                testID="date-from"
                placeholder={`From ${DATE_PLACEHOLDER}`}
                value={customFrom}
                onChangeText={setCustomFrom}
                style={s.dateInput}
                placeholderTextColor={colors.hint}
              />
            </View>
            <View style={[s.filterCell, gridWide && s.filterCellHalf]}>
              <Text style={s.inlineLabel}>To</Text>
              <TextInput
                testID="date-to"
                placeholder={`To ${DATE_PLACEHOLDER}`}
                value={customTo}
                onChangeText={setCustomTo}
                style={s.dateInput}
                placeholderTextColor={colors.hint}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  advPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    ...Platform.select({ web: { boxShadow: "0 1px 3px rgba(15,23,42,0.05)" } as any, default: {} }),
  },
  advPanelEmbedded: { borderWidth: 0, marginBottom: 0, padding: 0, shadowOpacity: 0 },
  advPanelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  advPanelTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  filterSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  filterSectionFirst: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  filterGroupTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  filterGrid: { gap: spacing.md },
  filterGridWide: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  filterCell: { width: "100%" },
  filterCellHalf: { flex: 1, minWidth: 220, maxWidth: "50%" as any },
  filterHint: { fontSize: 12, color: colors.muted2, marginTop: 6, fontStyle: "italic" },
  inlineLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 6 },
  dateInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    fontSize: 13,
    backgroundColor: colors.surface,
  },
  emptyHint: { fontSize: 13, color: colors.muted2, lineHeight: 18 },
});

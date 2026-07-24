import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, formColors, radii, spacing } from "./theme";
import { useBreakpoint } from "./useBreakpoint";
import { FilterSelect, filterSelectSlotStyle } from "./components/FilterSelect";
import type { FormSelectOption } from "./components/forms/FormSelect";
import { PWS_CLASS_OPTIONS, PWS_CLASS_FILTER_LABELS, pwsClassFilterLabel } from "./StudentRosterFormFields";

const PAGE_SIZE = 10;
const STUDENT_TINT = "#2563EB";

function studentInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("");
}

function sectionBadgeStyle(label?: string) {
  const normalized = (label || "").trim().toUpperCase();
  if (normalized.includes("10")) {
    return { bg: "#F3E8FF", text: "#7E22CE", border: "#E9D5FF" };
  }
  if (normalized.includes("9")) {
    return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
  }
  return { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" };
}

function classBadgeStyle(pwsClass?: string) {
  const label = pwsClassFilterLabel(pwsClass);
  if (label === "Nur" || label === "LKG" || label === "UKG") {
    return { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" };
  }
  if (label.startsWith("Std")) {
    return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
  }
  return { bg: "#F9FAFB", text: "#475569", border: "#E5E7EB" };
}

type StudentRosterListViewProps = {
  items: any[];
  loading: boolean;
  search: string;
  debouncedSearch: string;
  setSearch: (v: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  showDeactivated: boolean;
  setShowDeactivated: (v: boolean) => void;
  classFilter: string | null;
  setClassFilter: (v: string | null) => void;
  isAdmin: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onBack: () => void;
  onOpenStudent: (id: string) => void;
};

export function StudentRosterListView({
  items,
  loading,
  search,
  debouncedSearch,
  setSearch,
  onSearchSubmit,
  onClearSearch,
  showDeactivated,
  setShowDeactivated,
  classFilter,
  setClassFilter,
  isAdmin,
  canAdd,
  onAdd,
  onBack,
  onOpenStudent,
}: StudentRosterListViewProps) {
  const { horizontalPadding, contentMaxWidth, isDesktop } = useBreakpoint();
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(1);

  const pageStyle = {
    paddingHorizontal: horizontalPadding,
    maxWidth: contentMaxWidth,
    alignSelf: contentMaxWidth ? ("center" as const) : undefined,
    width: contentMaxWidth ? ("100%" as const) : undefined,
  };

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, total);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeSearch = debouncedSearch.trim();
  const isSearching = activeSearch.length > 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showDeactivated, classFilter, total]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const statusOptions: FormSelectOption[] = [
    { value: "active", label: "Active" },
    { value: "all", label: "All (incl. inactive)" },
  ];

  const classOptions: FormSelectOption[] = [
    { value: "", label: "All Classes" },
    ...PWS_CLASS_OPTIONS.map((c) => ({
      value: c,
      label: PWS_CLASS_FILTER_LABELS[c] || c,
    })),
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[s.page, pageStyle]}>
        <View style={s.headerSection}>
          <View style={s.titleRow}>
            <TouchableOpacity onPress={onBack} style={s.backBtn} testID="list-back">
              <Feather name="chevron-left" size={22} color={colors.ink} />
            </TouchableOpacity>
            <View style={s.titleGroup}>
              <Text style={s.h1}>Students</Text>
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>
                  {isSearching
                    ? `${total} matching record${total !== 1 ? "s" : ""}`
                    : `${total} record${total !== 1 ? "s" : ""}`}
                </Text>
              </View>
            </View>
          </View>

          <View style={s.toolbarRow}>
            <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
              <Feather name="search" size={15} color={searchFocused ? colors.primary : colors.hint} />
              <TextInput
                testID="people-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, ID, class, section…"
                placeholderTextColor={colors.hint}
                style={s.searchInput}
                onSubmitEditing={onSearchSubmit}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={onClearSearch} hitSlop={8} testID="clear-search">
                  <Feather name="x" size={15} color={colors.hint} />
                </TouchableOpacity>
              )}
            </View>

            {isAdmin && (
              <View style={filterSelectSlotStyle}>
                <FilterSelect
                  testID="toggle-status"
                  value={showDeactivated ? "all" : "active"}
                  options={statusOptions}
                  onChange={(v) => setShowDeactivated(v === "all")}
                />
              </View>
            )}

            <View style={filterSelectSlotStyle}>
              <FilterSelect
                testID="class-filter"
                value={classFilter || ""}
                options={classOptions}
                onChange={(v) => setClassFilter(v || null)}
              />
            </View>

            <TouchableOpacity
              testID="add-student"
              style={[s.addBtn, !canAdd && { opacity: 0.45 }]}
              disabled={!canAdd}
              onPress={onAdd}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={s.addText}>Add Student</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={STUDENT_TINT} style={{ marginTop: 32 }} />
        ) : total === 0 ? (
          <View style={s.empty}>
            <Feather name="users" size={36} color={colors.hint} />
            <Text style={s.emptyText}>
              {isSearching
                ? "No matching students found."
                : "No students yet. Tap Add Student to create one."}
            </Text>
            {isSearching && (
              <TouchableOpacity style={s.clearSearchBtn} onPress={onClearSearch} testID="empty-clear-search">
                <Feather name="x-circle" size={14} color={colors.primary} />
                <Text style={s.clearSearchTxt}>Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={!isDesktop}>
            <View style={[s.table, !isDesktop && s.tableWide]}>
              <View style={[s.tableRow, s.tableHead]}>
                <Text style={[s.th, s.colStudent]}>Student</Text>
                <Text style={[s.th, s.colId]}>Student ID</Text>
                <Text style={[s.th, s.colClass]}>Class</Text>
                <Text style={[s.th, s.colSection]}>Section</Text>
                <Text style={[s.th, s.colRoll]}>Roll Number</Text>
                <View style={s.colActions} />
              </View>

              {pageItems.map((it) => {
                const isDeact = it.status === "deactivated";
                const isPendingFee = it.status === "pending_fee_approval";
                const sectionLabel = it.group || "";
                const sectionBadge = sectionBadgeStyle(sectionLabel);
                const classBadge = classBadgeStyle(it.pws_class);
                const classLabel = pwsClassFilterLabel(it.pws_class);

                return (
                  <Pressable
                    key={it.id}
                    testID={`row-${it.id}`}
                    onPress={() => onOpenStudent(it.id)}
                    style={({ hovered }: any) => [s.tableRow, s.tableBodyRow, hovered && s.tableRowHover]}
                  >
                    <View style={[s.colStudent, s.studentCell]}>
                      <View style={[s.avatar, isDeact && s.avatarDeact]}>
                        <Text style={[s.avatarTxt, isDeact && s.avatarTxtDeact]}>
                          {studentInitials(it.name)}
                        </Text>
                      </View>
                      <View style={s.nameWrap}>
                        <Text style={[s.studentName, isDeact && s.studentNameDeact]}>{it.name}</Text>
                        {isDeact && (
                          <View style={s.inactivePill}>
                            <Text style={s.inactivePillTxt}>Inactive</Text>
                          </View>
                        )}
                        {isPendingFee && (
                          <View style={s.pendingFeePill}>
                            <Text style={s.pendingFeePillTxt}>Pending Fee Approval</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={[s.td, s.colId, s.idCell]}>
                      {it.admission_number || "—"}
                    </Text>

                    <View style={s.colClass}>
                      {classLabel ? (
                        <View style={[s.classBadge, { backgroundColor: classBadge.bg, borderColor: classBadge.border }]}>
                          <Text style={[s.classBadgeTxt, { color: classBadge.text }]}>{classLabel}</Text>
                        </View>
                      ) : (
                        <Text style={s.dash}>—</Text>
                      )}
                    </View>

                    <View style={s.colSection}>
                      {sectionLabel ? (
                        <View style={[s.sectionBadge, { backgroundColor: sectionBadge.bg, borderColor: sectionBadge.border }]}>
                          <Text style={[s.sectionBadgeTxt, { color: sectionBadge.text }]}>{sectionLabel}</Text>
                        </View>
                      ) : (
                        <Text style={s.dash}>—</Text>
                      )}
                    </View>

                    <Text style={[s.td, s.colRoll, s.rollCell]}>
                      {it.roll_number != null && it.roll_number !== "" ? String(it.roll_number) : "—"}
                    </Text>

                    <View style={s.colActions}>
                      <Pressable
                        testID={`view-${it.id}`}
                        onPress={() => onOpenStudent(it.id)}
                        style={({ hovered }: any) => [s.actionBtn, hovered && s.actionBtnHover]}
                      >
                        <Feather name="more-vertical" size={16} color={colors.muted2} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {!loading && total > 0 && (
          <View style={s.footer}>
            <Text style={s.footerText}>
              {isSearching
                ? `Showing ${startIdx}–${endIdx} of ${total} matching student${total !== 1 ? "s" : ""}`
                : `Showing ${startIdx}–${endIdx} of ${total} student${total !== 1 ? "s" : ""}`}
            </Text>
            <View style={s.pagination}>
              <TouchableOpacity
                testID="page-prev"
                style={[s.pageBtn, safePage <= 1 && s.pageBtnDisabled]}
                disabled={safePage <= 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Feather name="chevron-left" size={16} color={safePage <= 1 ? colors.hint : colors.ink} />
                <Text style={[s.pageBtnTxt, safePage <= 1 && s.pageBtnTxtDisabled]}>Previous</Text>
              </TouchableOpacity>
              <Text style={s.pageIndicator}>
                {safePage} / {totalPages}
              </Text>
              <TouchableOpacity
                testID="page-next"
                style={[s.pageBtn, safePage >= totalPages && s.pageBtnDisabled]}
                disabled={safePage >= totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <Text style={[s.pageBtnTxt, safePage >= totalPages && s.pageBtnTxtDisabled]}>Next</Text>
                <Feather name="chevron-right" size={16} color={safePage >= totalPages ? colors.hint : colors.ink} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: formColors.pageBg },
  page: { paddingTop: spacing.lg, paddingBottom: 48, gap: spacing.lg },
  headerSection: { gap: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: { padding: 6, marginLeft: -6 },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  countBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  countBadgeTxt: { fontSize: 12, fontWeight: "600", color: colors.muted2 },
  toolbarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  searchWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 200,
    maxWidth: 320,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 9 : 8,
    ...Platform.select({
      web: { transition: "border-color 0.15s ease, box-shadow 0.15s ease" } as object,
      default: {},
    }),
  },
  searchWrapFocused: {
    borderColor: "#1D4ED8",
    ...Platform.select({
      web: { boxShadow: "0 0 0 3px rgba(29, 78, 216, 0.12)" } as object,
      default: {},
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    padding: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: STUDENT_TINT,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.md,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  table: {
    flex: 1,
    minWidth: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)" } as object,
      default: {},
    }),
  },
  tableWide: { minWidth: 820 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  tableHead: {
    paddingVertical: 10,
    backgroundColor: "#FAFBFC",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableBodyRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  tableRowHover: Platform.select({
    web: { backgroundColor: "#F9FAFB" } as object,
    default: {},
  }),
  th: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: { fontSize: 13, color: colors.ink },
  colStudent: { flex: 2.4, minWidth: 200 },
  colId: { flex: 1.3, minWidth: 110 },
  colClass: { flex: 0.9, minWidth: 72 },
  colSection: { flex: 0.9, minWidth: 72 },
  colRoll: { flex: 0.8, minWidth: 80 },
  colActions: { width: 40, alignItems: "flex-end" },
  studentCell: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarDeact: { backgroundColor: "#E2E8F0" },
  avatarTxt: { fontWeight: "800", fontSize: 12, color: "#1D4ED8" },
  avatarTxtDeact: { color: "#64748B" },
  nameWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  studentName: { fontSize: 14, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  studentNameDeact: { color: colors.muted2 },
  inactivePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  inactivePillTxt: { fontSize: 9, fontWeight: "800", color: "#64748B" },
  pendingFeePill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingFeePillTxt: { fontSize: 9, fontWeight: "800", color: "#B45309" },
  idCell: {
    color: "#475569",
    fontWeight: "600",
    fontFamily: Platform.select({ web: "ui-monospace, SFMono-Regular, Menlo, monospace", default: undefined }),
  },
  classBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  classBadgeTxt: { fontSize: 11, fontWeight: "700" },
  sectionBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  sectionBadgeTxt: { fontSize: 11, fontWeight: "700" },
  rollCell: { color: colors.muted, fontWeight: "600" },
  dash: { fontSize: 13, color: colors.hint },
  actionBtn: {
    padding: 6,
    borderRadius: radii.sm,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  actionBtnHover: Platform.select({
    web: { backgroundColor: "#F3F4F6" } as object,
    default: {},
  }),
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  footerText: { fontSize: 13, color: colors.muted2, fontWeight: "500" },
  pagination: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnTxt: { fontSize: 13, fontWeight: "600", color: colors.ink },
  pageBtnTxtDisabled: { color: colors.hint },
  pageIndicator: { fontSize: 13, fontWeight: "600", color: colors.muted2, minWidth: 48, textAlign: "center" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: 13 },
  clearSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  clearSearchTxt: { fontSize: 13, fontWeight: "700", color: colors.primary },
});

import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";
import type { FeeSort, FeeStatusFilter, Institution } from "../../feesCollectionTypes";

const CENTRES = ["Balua", "Harding Park"] as const;
const SPORTS = ["Cricket", "Football"] as const;

const STATUS_OPTIONS: { id: FeeStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "due_this_month", label: "Due This Month" },
  { id: "paid_ahead", label: "Paid Ahead" },
];

const SORT_OPTIONS: { id: FeeSort; label: string }[] = [
  { id: "amount_due", label: "Amount Due ↓" },
  { id: "name", label: "Name A–Z" },
  { id: "overdue_days", label: "Overdue Days ↓" },
];

type Props = {
  institution: Institution;
  onInstitution: (i: Institution) => void;
  showInstitutionSwitch: boolean;
  search: string;
  onSearch: (v: string) => void;
  status: FeeStatusFilter;
  onStatus: (s: FeeStatusFilter) => void;
  sort: FeeSort;
  onSort: (s: FeeSort) => void;
  centre: string | null;
  onCentre: (c: string | null) => void;
  sport: string | null;
  onSport: (s: string | null) => void;
  sections: string[];
};

export function CompactFilterBar(props: Props) {
  const {
    institution, onInstitution, showInstitutionSwitch,
    search, onSearch, status, onStatus, sort, onSort,
    centre, onCentre, sport, onSport, sections,
  } = props;

  const statusLabel = STATUS_OPTIONS.find((o) => o.id === status)?.label ?? "All";
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label ?? "Amount Due ↓";

  return (
    <View style={s.card} testID="compact-filter-bar">
      <View style={s.row1}>
        {showInstitutionSwitch ? (
          <View style={s.instGroup}>
            {(["PWS", "ALPHA"] as const).map((inst) => {
              const active = institution === inst;
              return (
                <Pressable
                  key={inst}
                  testID={`inst-${inst}`}
                  onPress={() => onInstitution(inst)}
                  style={[s.instBtn, active && s.instBtnActive]}
                >
                  <Text style={[s.instTxt, active && s.instTxtActive]}>
                    {inst === "PWS" ? "PWS" : "ALPHA"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={s.instLocked}>
            <Text style={s.instLockedTxt}>{institution === "PWS" ? "PWS School" : "ALPHA Sports"}</Text>
          </View>
        )}

        <View style={s.searchWrap}>
          <Feather name="search" size={15} color={colors.hint} />
          <TextInput
            testID="search-input"
            value={search}
            onChangeText={onSearch}
            placeholder="Search player name or mobile"
            placeholderTextColor={colors.hint}
            style={s.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => onSearch("")} hitSlop={8}>
              <Feather name="x" size={15} color={colors.hint} />
            </Pressable>
          )}
        </View>

        <CompactDropdown
          testID="status-dropdown"
          label={`Status: ${statusLabel}`}
          options={STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          value={status}
          onChange={(id) => onStatus(id as FeeStatusFilter)}
        />
      </View>

      <View style={s.row2}>
        {institution === "ALPHA" ? (
          <>
            <ChipGroup
              label="Centre"
              testPrefix="centre"
              options={[null, ...CENTRES]}
              value={centre}
              onChange={onCentre}
            />
            <ChipGroup
              label="Sport"
              testPrefix="sport"
              options={[null, ...SPORTS]}
              value={sport}
              onChange={onSport}
            />
          </>
        ) : (
          <ChipGroup
            label="Section"
            testPrefix="section"
            options={[null, ...sections]}
            value={centre}
            onChange={onCentre}
          />
        )}
        <View style={{ flex: 1 }} />
        <CompactDropdown
          testID="sort-dropdown"
          label={`Sort: ${sortLabel}`}
          options={SORT_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          value={sort}
          onChange={(id) => onSort(id as FeeSort)}
          align="right"
        />
      </View>
    </View>
  );
}

function ChipGroup<T extends string | null>({
  label, testPrefix, options, value, onChange,
}: {
  label: string;
  testPrefix: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.chipGroup}>
      <Text style={s.chipLabel}>{label}</Text>
      <View style={s.chips}>
        {options.map((opt) => {
          const active = (opt ?? "all") === (value ?? "all");
          return (
            <Pressable
              key={String(opt)}
              testID={`${testPrefix}-${opt ?? "all"}`}
              onPress={() => onChange(opt)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipTxt, active && s.chipTxtActive]}>{opt ?? "All"}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function CompactDropdown({
  label, options, value, onChange, testID, align = "left",
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  testID?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable testID={testID} onPress={() => setOpen(true)} style={s.dropdownBtn}>
        <Text style={s.dropdownTxt} numberOfLines={1}>{label}</Text>
        <Feather name="chevron-down" size={14} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => setOpen(false)}>
          <View style={[s.menu, align === "right" && { alignSelf: "flex-end", marginRight: 16 }]}>
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
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  row1: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  row2: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  instGroup: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  instBtn: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface2 },
  instBtnActive: { backgroundColor: colors.primary },
  instTxt: { fontSize: 11, fontWeight: "800", color: colors.muted },
  instTxtActive: { color: "#fff" },
  instLocked: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
  },
  instLockedTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  searchWrap: {
    flex: 1,
    minWidth: 160,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink, outlineStyle: "none" as any, padding: 0 },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    maxWidth: 180,
  },
  dropdownTxt: { fontSize: 12, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  chipGroup: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chipLabel: { fontSize: 11, fontWeight: "700", color: colors.hint },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  chipTxtActive: { color: "#fff" },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.25)", justifyContent: "flex-start", paddingTop: 120, paddingHorizontal: 16 },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    minWidth: 200,
    maxWidth: 280,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  menuItemActive: { backgroundColor: colors.primarySofter },
  menuTxt: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  menuTxtActive: { color: colors.primary, fontWeight: "700" },
});

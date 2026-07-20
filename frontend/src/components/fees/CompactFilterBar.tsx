import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Platform, type View as RNView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";
import type { FeeSort, FeeStatusFilter, Institution } from "../../feesCollectionTypes";

const CENTRES = ["Balua", "Harding Park"] as const;
const SPORTS = ["Cricket", "Football"] as const;
const ALL_VALUE = "all";

const INSTITUTION_OPTIONS: { id: Institution; label: string }[] = [
  { id: "PWS", label: "PWS" },
  { id: "ALPHA", label: "ALPHA" },
];

const STATUS_OPTIONS: { id: FeeStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "due_this_month", label: "Due This Month" },
  { id: "paid_ahead", label: "Paid Ahead" },
];

const SORT_OPTIONS: { id: FeeSort; label: string }[] = [
  { id: "amount_due", label: "Amount Due ↓" },
  { id: "amount_due_asc", label: "Amount Due ↑" },
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

function nullableSelectValue(value: string | null): string {
  return value || ALL_VALUE;
}

function nullableSelectChange(id: string): string | null {
  return id === ALL_VALUE ? null : id;
}

export function CompactFilterBar(props: Props) {
  const {
    institution, onInstitution, showInstitutionSwitch,
    search, onSearch, status, onStatus, sort, onSort,
    centre, onCentre, sport, onSport, sections,
  } = props;

  const centreOptions = [
    { id: ALL_VALUE, label: "All Centres" },
    ...CENTRES.map((c) => ({ id: c, label: c })),
  ];

  const sportOptions = [
    { id: ALL_VALUE, label: "All Sports" },
    ...SPORTS.map((sp) => ({ id: sp, label: sp })),
  ];

  const sectionOptions = [
    { id: ALL_VALUE, label: "All Sections" },
    ...sections.map((sec) => ({ id: sec, label: sec })),
  ];

  return (
    <View style={s.card} testID="compact-filter-bar">
      <View style={s.row1}>
        {showInstitutionSwitch ? (
          <CompactDropdown
            testID="entity-dropdown"
            prefix="Entity"
            options={INSTITUTION_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
            value={institution}
            onChange={(id) => onInstitution(id as Institution)}
          />
        ) : (
          <View style={s.lockedFilter}>
            <Text style={s.lockedFilterTxt}>Entity: {institution === "PWS" ? "PWS" : "ALPHA"}</Text>
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
          prefix="Status"
          options={STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          value={status}
          onChange={(id) => onStatus(id as FeeStatusFilter)}
        />
      </View>

      <View style={s.row2}>
        {institution === "ALPHA" ? (
          <>
            <CompactDropdown
              testID="centre-dropdown"
              prefix="Centre"
              options={centreOptions}
              value={nullableSelectValue(centre)}
              onChange={(id) => onCentre(nullableSelectChange(id))}
            />
            <CompactDropdown
              testID="sport-dropdown"
              prefix="Sport"
              options={sportOptions}
              value={nullableSelectValue(sport)}
              onChange={(id) => onSport(nullableSelectChange(id))}
            />
          </>
        ) : (
          <CompactDropdown
            testID="section-dropdown"
            prefix="Section"
            options={sectionOptions}
            value={nullableSelectValue(centre)}
            onChange={(id) => onCentre(nullableSelectChange(id))}
          />
        )}

        <View style={s.rowSpacer} />

        <CompactDropdown
          testID="sort-dropdown"
          prefix="Sort"
          options={SORT_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
          value={sort}
          onChange={(id) => onSort(id as FeeSort)}
          align="right"
        />
      </View>
    </View>
  );
}

function CompactDropdown({
  prefix, options, value, onChange, testID, align = "left",
}: {
  prefix: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  testID?: string;
  align?: "left" | "right";
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
      <View style={[s.dropdownWrap, align === "right" && s.dropdownWrapRight]}>
        <View style={s.dropdownBtn}>
          <Text style={s.dropdownPrefix} numberOfLines={1}>{prefix}:</Text>
          <select
            data-testid={testID}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={s.webSelect}
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <Feather name="chevron-down" size={14} color={colors.muted} />
        </View>
      </View>
    );
  }

  return (
    <View
      ref={rootRef}
      style={[s.dropdownWrap, { zIndex: open ? 50 : 1 }, align === "right" && s.dropdownWrapRight]}
    >
      <Pressable testID={testID} onPress={() => setOpen((v) => !v)} style={s.dropdownBtn}>
        <Text style={s.dropdownTxt} numberOfLines={1}>{prefix}: {selectedLabel}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
      </Pressable>
      {open && (
        <View style={[s.menu, align === "right" && s.menuRight]}>
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

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
    gap: 10,
    overflow: "visible",
  },
  row1: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    overflow: "visible",
  },
  row2: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    overflow: "visible",
  },
  rowSpacer: { flex: 1, minWidth: 8 },
  lockedFilter: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    flexShrink: 0,
  },
  lockedFilterTxt: { fontSize: 12, fontWeight: "600", color: colors.muted },
  searchWrap: {
    flex: 1,
    minWidth: 180,
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
  dropdownWrap: { position: "relative", flexShrink: 0 },
  dropdownWrapRight: { marginLeft: "auto" },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    flexShrink: 0,
    minWidth: 148,
    maxWidth: 220,
  },
  dropdownPrefix: { fontSize: 12, fontWeight: "600", color: colors.ink, flexShrink: 0 },
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
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    minWidth: 220,
    maxWidth: 320,
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
  menuRight: { left: undefined, right: 0 },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  menuItemActive: { backgroundColor: colors.primarySofter },
  menuTxt: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  menuTxtActive: { color: colors.primary, fontWeight: "700" },
});

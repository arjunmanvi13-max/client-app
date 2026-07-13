import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../../theme";
import type { FeeSort, FeeStatusFilter } from "../../feesCollectionTypes";

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

export function StatusFilterChips({
  status,
  sort,
  onStatus,
  onSort,
}: {
  status: FeeStatusFilter;
  sort: FeeSort;
  onStatus: (s: FeeStatusFilter) => void;
  onSort: (s: FeeSort) => void;
}) {
  return (
    <View testID="status-filter-chips">
      <Text style={s.filterLabel}>STATUS</Text>
      <View style={s.row}>
        {STATUS_OPTIONS.map((opt) => {
          const active = status === opt.id;
          return (
            <Pressable
              key={opt.id}
              testID={`status-${opt.id}`}
              onPress={() => onStatus(opt.id)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipTxt, active && s.chipTxtActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[s.filterLabel, { marginTop: 12 }]}>SORT BY</Text>
      <View style={s.row}>
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.id;
          return (
            <Pressable
              key={opt.id}
              testID={`sort-${opt.id}`}
              onPress={() => onSort(opt.id)}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipTxt, active && s.chipTxtActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  filterLabel: { fontSize: 10, fontWeight: "800", color: colors.hint, letterSpacing: 1.4, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  chipTxtActive: { color: "#fff" },
});

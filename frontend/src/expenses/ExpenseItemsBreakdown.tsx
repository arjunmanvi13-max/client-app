import { View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../theme";
import { getExpenseLineItems } from "./expenseItemUtils";
import { formatInr } from "./expenseFormat";
import type { ExpenseEntry } from "./expenseTypes";

type Props = {
  entry: Pick<ExpenseEntry, "items" | "rate" | "quantity" | "amount" | "sub_category" | "expense_head_name">;
  compact?: boolean;
};

export function ExpenseItemsBreakdown({ entry, compact }: Props) {
  const items = getExpenseLineItems(entry);
  if (items.length === 0) return null;

  if (compact && items.length === 1) {
    const it = items[0];
    return (
      <Text style={s.compact}>
        {it.item_name} · {formatInr(it.rate, 0)} × {it.quantity} = {formatInr(it.amount)}
      </Text>
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.headRow}>
        <Text style={[s.th, s.colItem]}>Item</Text>
        <Text style={[s.th, s.colNum]}>Rate</Text>
        <Text style={[s.th, s.colNum]}>Qty</Text>
        <Text style={[s.th, s.colAmt]}>Amount</Text>
      </View>
      {items.map((it, idx) => (
        <View key={`${it.item_name}-${idx}`} style={[s.row, idx % 2 === 1 && s.rowAlt]}>
          <Text style={[s.td, s.colItem]} numberOfLines={2}>{it.item_name}</Text>
          <Text style={[s.td, s.colNum]}>{formatInr(it.rate, 0)}</Text>
          <Text style={[s.td, s.colNum]}>{it.quantity}</Text>
          <Text style={[s.td, s.colAmt, s.amt]}>{formatInr(it.amount)}</Text>
        </View>
      ))}
      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Total Amount</Text>
        <Text style={s.totalValue}>{formatInr(entry.amount)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surface2,
  },
  headRow: { flexDirection: "row", backgroundColor: colors.borderSoft, paddingVertical: 6, paddingHorizontal: spacing.sm },
  th: { fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  rowAlt: { backgroundColor: colors.surface },
  td: { fontSize: 12, color: colors.ink },
  colItem: { flex: 2.2 },
  colNum: { flex: 0.9, textAlign: "right" },
  colAmt: { flex: 1.1, textAlign: "right" },
  amt: { fontWeight: "700" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.primarySofter,
  },
  totalLabel: { fontSize: 12, fontWeight: "800", color: colors.primary },
  totalValue: { fontSize: 14, fontWeight: "800", color: colors.ink },
  compact: { fontSize: 11, color: colors.muted2 },
});

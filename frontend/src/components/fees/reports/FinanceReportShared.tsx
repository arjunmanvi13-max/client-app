import { View, Text, StyleSheet, ScrollView } from "react-native";
import { colors, radii, spacing } from "../../theme";
import { DataTable } from "../../ScreenStates";

export function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function SummaryCards({ items }: { items: { label: string; value: string; tone?: "default" | "success" | "warn" | "danger" }[] }) {
  return (
    <View style={s.summaryRow}>
      {items.map((item) => (
        <View key={item.label} style={s.summaryCard}>
          <Text style={s.summaryLabel}>{item.label}</Text>
          <Text style={[s.summaryValue, item.tone === "success" && { color: colors.success }, item.tone === "warn" && { color: "#D97706" }, item.tone === "danger" && { color: colors.danger }]}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function BucketCards({ buckets }: { buckets: { label: string; count: number; amount: number }[] }) {
  return (
    <View style={s.summaryRow}>
      {buckets.map((b) => (
        <View key={b.label} style={s.bucketCard}>
          <Text style={s.bucketLabel}>{b.label}</Text>
          <Text style={s.bucketAmt}>{inr(b.amount)}</Text>
          <Text style={s.bucketSub}>{b.count} students</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportTable({ columns, rows, numericFromIndex = 1 }: { columns: string[]; rows: string[][]; numericFromIndex?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ minWidth: "100%" }}>
        <DataTable columns={columns} rows={rows} numericFromIndex={numericFromIndex} />
      </View>
    </ScrollView>
  );
}

export function BarChartSimple({ items, valueKey }: { items: { label: string; expected?: number; collected?: number; amount?: number }[]; valueKey: "expected" | "collected" | "amount" }) {
  const max = Math.max(...items.map((i) => (valueKey === "amount" ? i.amount : i[valueKey]) || 0), 1);
  return (
    <View style={s.chartBlock}>
      {items.map((item) => {
        const val = (valueKey === "amount" ? item.amount : item[valueKey]) || 0;
        return (
          <View key={item.label} style={s.barRow}>
            <Text style={s.barLabel}>{item.label}</Text>
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${Math.max(8, (val / max) * 100)}%` }]} />
            </View>
            <Text style={s.barVal}>{inr(val)}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function DonutLegend({ items }: { items: { label: string; amount: number; pct: number; color: string }[] }) {
  return (
    <View style={s.legendWrap}>
      {items.map((item) => (
        <View key={item.label} style={s.legendRow}>
          <View style={[s.legendDot, { backgroundColor: item.color }]} />
          <Text style={s.legendLabel}>{item.label}</Text>
          <Text style={s.legendPct}>{item.pct}%</Text>
          <Text style={s.legendAmt}>{inr(item.amount)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryLabel: { fontSize: 11, fontWeight: "700", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.4 },
  summaryValue: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 4 },
  bucketCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  bucketLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  bucketAmt: { fontSize: 16, fontWeight: "800", color: colors.ink, marginTop: 4 },
  bucketSub: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  chartBlock: { gap: spacing.sm, marginBottom: spacing.md },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { width: 72, fontSize: 11, fontWeight: "600", color: colors.muted },
  barTrack: { flex: 1, height: 10, backgroundColor: colors.surface2, borderRadius: radii.pill, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.primary, borderRadius: radii.pill },
  barVal: { width: 80, textAlign: "right", fontSize: 11, fontWeight: "700", color: colors.ink },
  legendWrap: { gap: spacing.sm, marginBottom: spacing.md },
  legendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink },
  legendPct: { width: 36, fontSize: 12, fontWeight: "700", color: colors.muted, textAlign: "right" },
  legendAmt: { width: 90, fontSize: 12, fontWeight: "700", color: colors.ink, textAlign: "right" },
});

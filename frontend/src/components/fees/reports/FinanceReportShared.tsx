import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { colors, radii, spacing } from "../../../theme";

const TABLE_MAX_HEIGHT = 420;

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
  const stickyHead = (
    <View style={s.tableHead}>
      {columns.map((c, i) => (
        <Text
          key={i}
          style={[s.th, i === 0 && s.thFirst, i >= numericFromIndex && s.thNum]}
          numberOfLines={1}
        >
          {c}
        </Text>
      ))}
    </View>
  );

  const body = rows.length ? (
    <ScrollView style={s.tableBodyScroll} nestedScrollEnabled showsVerticalScrollIndicator>
      {rows.map((row, ri) => (
        <View key={ri} style={[s.tr, ri % 2 === 1 && s.trAlt]}>
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={[s.td, ci === 0 && s.tdFirst, ci >= numericFromIndex && s.tdNum]}
              numberOfLines={2}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  ) : (
    <Text style={s.tableEmpty}>No rows to display.</Text>
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.tableWrap}>
        {stickyHead}
        {body}
      </View>
    </ScrollView>
  );
}

export function DonutChart({ items }: { items: { label: string; pct: number; color: string }[] }) {
  const gradient = items.reduce((acc, item, i) => {
    const start = items.slice(0, i).reduce((sum, x) => sum + x.pct, 0);
    const end = start + item.pct;
    const sep = i < items.length - 1 ? ", " : "";
    return `${acc}${item.color} ${start}% ${end}%${sep}`;
  }, "");

  return (
    <View style={s.donutRow}>
      {Platform.OS === "web" ? (
        <View style={s.donutOuter}>
          <View style={[s.donutRing, { background: `conic-gradient(${gradient})` } as object]} />
          <View style={s.donutHole} />
        </View>
      ) : (
        <View style={s.donutOuter}>
          <View style={s.donutFallback}>
            {items.map((item) => (
              <View key={item.label} style={[s.donutSlice, { flex: Math.max(item.pct, 1), backgroundColor: item.color }]} />
            ))}
          </View>
          <View style={s.donutHole} />
        </View>
      )}
      <View style={s.donutMeta}>
        <Text style={s.donutTitle}>Revenue Split</Text>
        {items.slice(0, 3).map((item) => (
          <Text key={item.label} style={s.donutMetaLine}>{item.pct}% · {item.label}</Text>
        ))}
      </View>
    </View>
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
  tableWrap: { marginTop: spacing.sm, minWidth: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: "hidden" },
  tableHead: { flexDirection: "row", backgroundColor: colors.primarySofter, borderBottomWidth: 1, borderBottomColor: colors.border, ...Platform.select({ web: { position: "sticky", top: 0, zIndex: 2 } as object, default: {} }) },
  tableBodyScroll: { maxHeight: TABLE_MAX_HEIGHT },
  tableEmpty: { padding: spacing.md, fontSize: 13, color: colors.muted2, fontStyle: "italic" },
  th: { flex: 1, minWidth: 100, paddingHorizontal: 10, paddingVertical: 10, fontSize: 11, fontWeight: "800", color: colors.ink, textTransform: "uppercase", letterSpacing: 0.3 },
  thFirst: { minWidth: 160 },
  thNum: { textAlign: "right" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  trAlt: { backgroundColor: colors.surface2 },
  td: { flex: 1, minWidth: 100, paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, color: colors.ink },
  tdFirst: { minWidth: 160, fontWeight: "600" },
  tdNum: { textAlign: "right", fontWeight: "700" },
  donutRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginBottom: spacing.md, flexWrap: "wrap" },
  donutOuter: { width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  donutRing: { position: "absolute", width: 132, height: 132, borderRadius: 66 },
  donutFallback: { position: "absolute", width: 132, height: 132, borderRadius: 66, overflow: "hidden", flexDirection: "row" },
  donutSlice: { height: "100%" },
  donutHole: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  donutMeta: { flex: 1, minWidth: 180, gap: 4 },
  donutTitle: { fontSize: 12, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  donutMetaLine: { fontSize: 11, color: colors.muted, fontWeight: "600" },
});

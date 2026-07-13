import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme";
import type { CollectionKpis } from "../../feesCollectionTypes";

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function SkeletonCard() {
  return <View style={[s.card, s.skeleton]} />;
}

export function FeeSummaryBar({ kpis, loading }: { kpis?: CollectionKpis; loading?: boolean }) {
  if (loading || !kpis) {
    return (
      <View style={s.row} testID="fee-summary-skeleton">
        <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
      </View>
    );
  }
  return (
    <View style={s.row} testID="fee-summary-bar">
      <KpiCard testID="kpi-total-players" label="Total Players" value={String(kpis.total_players)} tint={colors.primary} />
      <KpiCard testID="kpi-due-today" label="Due Today" value={inr(kpis.amount_due_today)} tint="#D97706" />
      <KpiCard testID="kpi-overdue" label="Overdue" value={String(kpis.overdue_count)} tint="#DC2626" />
      <KpiCard testID="kpi-collected" label="Collected (month)" value={inr(kpis.collected_this_month)} tint="#16A34A" />
    </View>
  );
}

function KpiCard({ label, value, tint, testID }: { label: string; value: string; tint: string; testID?: string }) {
  return (
    <View style={s.card} testID={testID}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, { color: tint }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  card: {
    flex: 1, minWidth: 140, padding: 12, backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  skeleton: { height: 64, backgroundColor: colors.surface2 },
  label: { fontSize: 10, fontWeight: "800", color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase" },
  value: { fontSize: 18, fontWeight: "800", marginTop: 4 },
});

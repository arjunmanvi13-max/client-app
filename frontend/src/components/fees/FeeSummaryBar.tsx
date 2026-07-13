import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors } from "../../theme";
import { inr } from "./feesUi";
import type { CollectionKpis } from "../../feesCollectionTypes";

type Props = {
  /** Filtered visible rows */
  visibleCount: number;
  outstanding: number;
  overdueCount: number;
  kpis?: CollectionKpis;
  loading?: boolean;
};

/** Compact inline financial metadata strip — not dashboard cards. */
export function FeeSummaryBar({ visibleCount, outstanding, overdueCount, kpis, loading }: Props) {
  if (loading) {
    return (
      <View style={s.wrap} testID="fee-summary-skeleton">
        <View style={[s.skeletonLine, { width: "88%" }]} />
      </View>
    );
  }

  const collected = kpis?.collected_this_month ?? 0;
  const label = visibleCount === 1 ? "Player" : "Players";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.wrap}
      testID="fee-summary-bar"
    >
      <Metric testID="kpi-players" value={String(visibleCount)} label={label} />
      <Dot />
      <Metric testID="kpi-outstanding" value={inr(outstanding)} label="Outstanding" strong />
      <Dot />
      <Metric testID="kpi-overdue" value={String(overdueCount)} label="Overdue" tint={overdueCount > 0 ? colors.danger : undefined} />
      <Dot />
      <Metric testID="kpi-collected" value={inr(collected)} label="Collected This Month" tint="#16A34A" />
    </ScrollView>
  );
}

function Metric({ label, value, strong, tint, testID }: {
  label: string; value: string; strong?: boolean; tint?: string; testID?: string;
}) {
  return (
    <View style={s.metric} testID={testID}>
      <Text style={[s.value, strong && s.valueStrong, tint ? { color: tint } : null]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

function Dot() {
  return <Text style={s.dot}>·</Text>;
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 10,
    gap: 4,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surface2,
  },
  metric: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingHorizontal: 2 },
  value: { fontSize: 13, fontWeight: "700", color: colors.ink },
  valueStrong: { fontSize: 14, fontWeight: "800" },
  label: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  dot: { fontSize: 14, color: colors.hint, paddingHorizontal: 6 },
});

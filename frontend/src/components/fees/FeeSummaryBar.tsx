import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadow } from "../../theme";
import { inr } from "./feesUi";
import type { CollectionKpis } from "../../feesCollectionTypes";

type Props = {
  visibleCount: number;
  outstanding: number;
  overdueCount: number;
  kpis?: CollectionKpis;
  loading?: boolean;
};

function recoveryTone(pct: number) {
  if (pct >= 80) return { fg: "#047857", track: "#D1FAE5", fill: "#10B981" };
  if (pct >= 50) return { fg: "#B45309", track: "#FEF3C7", fill: "#F59E0B" };
  return { fg: "#B91C1C", track: "#FEE2E2", fill: "#EF4444" };
}

export function FeeSummaryBar({ visibleCount, outstanding, overdueCount, kpis, loading }: Props) {
  if (loading) {
    return (
      <View style={s.row} testID="fee-summary-skeleton">
        {[1, 2, 3, 4].map((i) => <View key={i} style={s.skel} />)}
      </View>
    );
  }

  const collectedMonth = kpis?.collected_this_month ?? 0;
  const collectedToday = kpis?.collected_today ?? 0;
  const pending = kpis?.total_pending ?? outstanding;
  const recovery = Math.min(100, Math.max(0, kpis?.recovery_rate_pct ?? 0));
  const tone = recoveryTone(recovery);
  const pendingAccent = overdueCount > 0 ? "#EF4444" : "#F59E0B";

  return (
    <View style={s.row} testID="fee-summary-bar">
      <Metric
        testID="kpi-outstanding"
        icon="alert-circle"
        label="Total pending dues"
        value={inr(pending)}
        hint={`${visibleCount} on register · ${overdueCount} overdue`}
        accent={pendingAccent}
        tintBg={overdueCount > 0 ? "#FEF2F2" : "#FFFBEB"}
      />
      <Metric
        testID="kpi-collected"
        icon="check-circle"
        label="Collected today / month"
        value={inr(collectedToday)}
        hint={`${inr(collectedMonth)} this month`}
        accent="#10B981"
        tintBg="#ECFDF5"
      />
      <View style={[s.card, { borderTopColor: tone.fill }]} testID="kpi-recovery">
        <View style={s.cardHead}>
          <Feather name="trending-up" size={14} color={tone.fg} />
          <Text style={s.label}>Target recovery rate</Text>
        </View>
        <Text style={[s.value, { color: tone.fg }]}>{recovery}%</Text>
        <View style={[s.track, { backgroundColor: tone.track }]}>
          <View style={[s.fill, { width: `${recovery}%`, backgroundColor: tone.fill }]} />
        </View>
        <Text style={[s.hint, { color: tone.fg }]}>Collected vs pending this month</Text>
      </View>
    </View>
  );
}

function Metric({
  icon, label, value, hint, accent, tintBg, testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  hint: string;
  accent: string;
  tintBg: string;
  testID?: string;
}) {
  return (
    <View style={[s.card, { borderTopColor: accent, backgroundColor: colors.surface }]} testID={testID}>
      <View style={[s.iconWrap, { backgroundColor: tintBg }]}>
        <Feather name={icon} size={14} color={accent} />
      </View>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, { color: accent }]}>{value}</Text>
      <Text style={s.hint}>{hint}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  skel: { flex: 1, minWidth: 160, height: 96, borderRadius: radii.md, backgroundColor: colors.surface2 },
  card: {
    flex: 1,
    minWidth: 168,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderTopWidth: 3,
    padding: 12,
    ...shadow.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  iconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  label: { fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: 4 },
  hint: { fontSize: 11, color: colors.muted2, marginTop: 4, fontWeight: "600" },
  track: { height: 8, borderRadius: 99, overflow: "hidden", marginTop: 10 },
  fill: { height: 8, borderRadius: 99 },
});

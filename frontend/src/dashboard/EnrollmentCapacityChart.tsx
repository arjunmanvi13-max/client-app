import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, shadow } from "../theme";

export type CapacityBar = {
  key: string;
  campus: string;
  sport: string;
  enrolled: number;
  capacity: number;
  utilization_pct?: number | null;
  entity?: string;
};

type Props = {
  rows: CapacityBar[];
};

export function EnrollmentCapacityChart({ rows }: Props) {
  const visible = rows.filter((row) => row.enrolled > 0 || row.capacity > 0);
  const max = Math.max(1, ...visible.map((row) => Math.max(row.enrolled, row.capacity)));

  if (visible.length === 0) {
    return <Text style={s.empty}>No enrollment vs capacity data yet. Set academy baselines to populate this chart.</Text>;
  }

  return (
    <View testID="enrollment-capacity-chart">
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: "#059669" }]} />
          <Text style={s.legendTxt}>Current enrollments</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.swatch, { backgroundColor: colors.primary }]} />
          <Text style={s.legendTxt}>Maximum capacity</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chart}>
        {visible.map((row) => {
          const enrolledH = Math.round((row.enrolled / max) * 140);
          const capH = Math.round((row.capacity / max) * 140);
          const hot = (row.utilization_pct || 0) >= 90;
          return (
            <View key={row.key} style={s.col} testID={`capacity-bar-${row.key}`}>
              <View style={s.bars}>
                <View style={[s.bar, { height: Math.max(6, enrolledH), backgroundColor: "#059669" }]} />
                <View style={[s.bar, { height: Math.max(6, capH), backgroundColor: hot ? "#D97706" : colors.primary }]} />
              </View>
              <Text style={s.counts}>{row.enrolled}/{row.capacity || "—"}</Text>
              <Text style={s.campus} numberOfLines={1}>{row.campus}</Text>
              <Text style={[s.sport, hot && s.sportHot]} numberOfLines={2}>{row.sport}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 12, color: colors.hint, paddingVertical: 12 },
  legend: { flexDirection: "row", gap: 16, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendTxt: { fontSize: 11, fontWeight: "600", color: colors.muted2 },
  chart: { alignItems: "flex-end", gap: 10, paddingBottom: 4, minHeight: 210 },
  col: { width: 72, alignItems: "center" },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 148 },
  bar: { width: 22, borderRadius: 6, ...shadow.sm },
  counts: { marginTop: 6, fontSize: 10, fontWeight: "800", color: colors.ink2 },
  campus: { fontSize: 10, fontWeight: "700", color: colors.ink, textAlign: "center" },
  sport: { fontSize: 9, fontWeight: "600", color: colors.muted2, textAlign: "center" },
  sportHot: { color: "#B45309" },
});

import { Text, View, StyleSheet } from "react-native";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "../theme";
import type { CapacityBar } from "./EnrollmentCapacityChart";

type Props = { rows: CapacityBar[] };

export function EnrollmentCapacityChart({ rows }: Props) {
  const data = rows
    .filter((row) => row.enrolled > 0 || row.capacity > 0)
    .map((row) => ({
      label: `${row.campus} · ${row.sport}`,
      enrolled: row.enrolled,
      capacity: row.capacity,
    }));

  if (data.length === 0) {
    return (
      <Text style={s.empty}>
        No enrollment vs capacity data yet. Set academy baselines to populate this chart.
      </Text>
    );
  }

  return (
    <View style={s.wrap} testID="enrollment-capacity-chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} interval={0} angle={-28} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11, fill: "#64748B" }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number, name: string) => [value, name === "enrolled" ? "Current enrollments" : "Maximum capacity"]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="enrolled" name="Current enrollments" fill="#059669" radius={[6, 6, 0, 0]} />
          <Bar dataKey="capacity" name="Maximum capacity" fill={colors.primary} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: "100%", height: 280 },
  empty: { fontSize: 12, color: colors.hint, paddingVertical: 12 },
});

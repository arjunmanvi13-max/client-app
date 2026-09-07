import { Platform, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Props = {
  percent: number;
  label?: string;
  size?: number;
};

export function RadialGauge({ percent, label = "Today", size = 156 }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const tint = pct >= 85 ? "#059669" : pct >= 60 ? colors.accent : "#D97706";
  const track = "#E2E8F0";
  const inner = size - 22;

  return (
    <View style={[s.wrap, { width: size, height: size }]} testID="attendance-gauge">
      <View
        style={[
          s.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          Platform.OS === "web"
            ? ({ backgroundImage: `conic-gradient(${tint} ${pct}%, ${track} 0)` } as object)
            : { borderWidth: 12, borderColor: track, borderTopColor: tint, borderRightColor: pct > 25 ? tint : track },
        ]}
      >
        <View style={[s.hole, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text style={[s.value, { color: tint }]}>{pct}%</Text>
          <Text style={s.label}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  ring: { alignItems: "center", justifyContent: "center" },
  hole: {
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 32, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "700", color: colors.muted2, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },
});

import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from "react-native";
import { colors, formColors, radii } from "../../theme";

type PillSelectProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  scrollable?: boolean;
  testID?: string;
  formatOption?: (v: string) => string;
};

export function PillSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  scrollable,
  testID,
  formatOption = (v) => v,
}: PillSelectProps) {
  const pills = (
    <View style={s.row}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            testID={testID ? `${testID}-${opt.replace(/\s+/g, "-")}` : undefined}
            disabled={disabled}
            onPress={() => onChange(opt)}
            style={[s.pill, active && s.pillActive, disabled && s.pillDisabled]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[s.pillTxt, active && s.pillTxtActive]}>{formatOption(opt)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          {pills}
        </ScrollView>
      ) : (
        pills
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.2 },
  scrollContent: { paddingRight: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: "pointer", transition: "all 0.15s ease" } as object, default: {} }),
  },
  pillActive: {
    backgroundColor: formColors.primary,
    borderColor: formColors.primary,
  },
  pillDisabled: { opacity: 0.55 },
  pillTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  pillTxtActive: { color: "#fff" },
});

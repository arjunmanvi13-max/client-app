import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { colors, formColors, radii } from "../../theme";

type SegmentToggleProps<T extends string> = {
  label?: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  disabled?: boolean;
  testID?: string;
  formatLabel?: (v: T) => string;
};

export function SegmentToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  testID,
  formatLabel = (v) => v,
}: SegmentToggleProps<T>) {
  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.track} testID={testID}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              testID={testID ? `${testID}-${opt}` : undefined}
              disabled={disabled}
              onPress={() => onChange(opt)}
              style={[s.item, active && s.itemActive, disabled && s.itemDisabled]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.itemTxt, active && s.itemTxtActive]}>{formatLabel(opt)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.2 },
  track: {
    flexDirection: "row",
    backgroundColor: colors.surface2,
    borderRadius: radii.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    alignItems: "center",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  itemActive: { backgroundColor: formColors.primary },
  itemDisabled: { opacity: 0.6 },
  itemTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  itemTxtActive: { color: "#fff" },
});

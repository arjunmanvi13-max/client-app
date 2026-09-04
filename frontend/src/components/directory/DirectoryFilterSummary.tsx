import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";

export type DirectoryFilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export function DirectoryFilterSummary({
  chips,
  onClearAll,
  resultLabel,
}: {
  chips: DirectoryFilterChip[];
  onClearAll: () => void;
  resultLabel?: string;
}) {
  if (!chips.length && !resultLabel) return null;

  return (
    <View style={s.wrap} testID="directory-filter-summary">
      {resultLabel ? (
        <Text style={s.result} testID="directory-result-count">
          {resultLabel}
        </Text>
      ) : null}
      {chips.length > 0 && (
        <View style={s.chipRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {chips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                testID={`filter-chip-${chip.id}`}
                onPress={chip.onRemove}
                style={s.chip}
                accessibilityLabel={`Remove filter ${chip.label}`}
              >
                <Text style={s.chipTxt}>{chip.label}</Text>
                <Feather name="x" size={12} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={onClearAll}
            style={s.clearAll}
            testID="directory-clear-filters"
            accessibilityLabel="Clear all filters"
          >
            <Feather name="x-circle" size={13} color={colors.muted} />
            <Text style={s.clearAllTxt}>Clear all filters</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingHorizontal: 2,
  },
  result: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink2,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "#B6EAF8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  chipTxt: { fontSize: 11, fontWeight: "700", color: colors.primary },
  clearAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    paddingVertical: 4,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  clearAllTxt: { fontSize: 12, fontWeight: "700", color: colors.muted2 },
});

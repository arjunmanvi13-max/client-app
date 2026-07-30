import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radii } from "../theme";
import { restrictedEntityHint, type EntityId } from "../entityScopeUtils";

type Props = {
  value: EntityId;
  available: EntityId[];
  canSwitch: boolean;
  onChange: (entity: EntityId) => void;
  compact?: boolean;
};

export function EntityScopeToggle({ value, available, canSwitch, onChange, compact }: Props) {
  const options: EntityId[] = ["pws", "alpha"];

  return (
    <View style={[s.row, compact && s.rowCompact]}>
      {options.map((e) => {
        const enabled = available.includes(e);
        const active = value === e;
        const disabled = !enabled || (!canSwitch && !active);
        return (
          <TouchableOpacity
            key={e}
            disabled={disabled}
            style={[
              s.chip,
              active && s.chipActive,
              disabled && !active && s.chipDisabled,
            ]}
            onPress={() => enabled && onChange(e)}
            accessibilityState={{ disabled, selected: active }}
            accessibilityHint={disabled && !active ? restrictedEntityHint(e) : undefined}
          >
            <Text style={[s.chipTxt, active && s.chipTxtActive, disabled && !active && s.chipTxtDisabled]}>
              {e.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function EntityScopeBadge({ entity, restricted }: { entity: string; restricted?: boolean }) {
  return (
    <View style={[s.badge, restricted && s.badgeRestricted]}>
      <Text style={s.badgeTxt}>{entity.toUpperCase()}{restricted ? " · locked" : ""}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  rowCompact: { marginBottom: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.45 },
  chipTxt: { fontSize: 13, fontWeight: "600", color: colors.muted2 },
  chipTxtActive: { color: "#fff" },
  chipTxtDisabled: { color: colors.muted },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
  },
  badgeRestricted: { backgroundColor: colors.borderSoft },
  badgeTxt: { fontSize: 11, fontWeight: "700", color: colors.primary, letterSpacing: 0.4 },
});

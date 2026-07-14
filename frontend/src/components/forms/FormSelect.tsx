import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";

export type FormSelectOption = { value: string; label: string };

type FormSelectProps = {
  label: string;
  value: string;
  options: FormSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function FormSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  required,
  disabled,
  testID,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[s.trigger, disabled && s.triggerDisabled]}
      >
        <Text style={[s.triggerText, !selected && s.placeholder]} numberOfLines={1}>
          {selected?.label || placeholder}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.hint} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.menu}>
            {options.map((opt) => (
              <Pressable
                key={opt.value}
                testID={testID ? `${testID}-opt-${opt.value}` : undefined}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={[s.menuItem, value === opt.value && s.menuItemActive]}
              >
                <Text style={[s.menuItemText, value === opt.value && s.menuItemTextActive]}>
                  {opt.label}
                </Text>
                {value === opt.value && <Feather name="check" size={16} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  field: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 8 },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerDisabled: { backgroundColor: colors.surface2, opacity: 0.85 },
  triggerText: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: "500" },
  placeholder: { color: colors.hint, fontWeight: "400" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
    maxHeight: 360,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.sm,
  },
  menuItemActive: { backgroundColor: colors.primarySofter },
  menuItemText: { fontSize: 15, color: colors.ink, fontWeight: "500" },
  menuItemTextActive: { color: colors.primary, fontWeight: "700" },
});

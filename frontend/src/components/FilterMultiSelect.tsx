import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, type View as RNView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import type { FormSelectOption } from "./forms/FormSelect";
import { TOOLBAR_CONTROL_HEIGHT } from "./FilterSelect";

export function FilterMultiSelect({
  values,
  options,
  onChange,
  disabled,
  testID,
  groupLabel,
  placeholder,
}: {
  values: string[];
  options: FormSelectOption[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  testID?: string;
  groupLabel: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<RNView>(null);
  const count = values.length;
  const active = count > 0;
  const label = active ? `${groupLabel} (${count})` : (placeholder || groupLabel);

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return;
    const onDocClick = (e: MouseEvent) => {
      const node = rootRef.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (value: string) => {
    if (disabled) return;
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  return (
    <View ref={rootRef} style={s.wrap}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[s.trigger, disabled && s.triggerDisabled, active && s.triggerActive]}
        accessibilityLabel={label}
      >
        <Text style={s.triggerTxt} numberOfLines={1}>{label}</Text>
        {active ? (
          <View style={s.countBadge}>
            <Text style={s.countBadgeTxt}>{count}</Text>
          </View>
        ) : (
          <Feather name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.hint} />
        )}
      </Pressable>
      {open && (
        <View style={s.menu}>
          {options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                testID={testID ? `${testID}-opt-${opt.value}` : undefined}
                onPress={() => toggle(opt.value)}
                style={[s.menuItem, checked && s.menuItemActive]}
              >
                <View style={[s.box, checked && s.boxChecked]}>
                  {checked ? <Feather name="check" size={11} color="#fff" /> : null}
                </View>
                <Text style={[s.menuTxt, checked && s.menuTxtActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "relative", zIndex: 6 },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    height: TOOLBAR_CONTROL_HEIGHT,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  triggerDisabled: { backgroundColor: colors.surface2, opacity: 0.85 },
  triggerActive: { backgroundColor: colors.accentSoft, borderColor: "#7DD3EA" },
  triggerTxt: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink },
  countBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#fff" },
  menu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    zIndex: 30,
    maxHeight: 240,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" } as object,
      default: {},
    }),
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  menuItemActive: { backgroundColor: colors.accentSoft },
  box: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  boxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  menuTxt: { fontSize: 13, color: colors.ink, fontWeight: "500", flex: 1 },
  menuTxtActive: { color: colors.primary, fontWeight: "700" },
});

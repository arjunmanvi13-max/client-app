import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, type View as RNView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../theme";
import type { FormSelectOption } from "./forms/FormSelect";

export function FilterSelect({
  value,
  options,
  onChange,
  disabled,
  testID,
}: {
  value: string;
  options: FormSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  testID?: string;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={s.filterSelectWrap}>
        <select
          data-testid={testID}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            boxSizing: "border-box",
            backgroundColor: disabled ? colors.surface2 : colors.surface,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: colors.border,
            borderRadius: radii.md,
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 10,
            paddingRight: 28,
            fontSize: 13,
            color: colors.ink,
            fontWeight: "600",
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            opacity: disabled ? 0.85 : 1,
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <View style={s.filterChevron} pointerEvents="none">
          <Feather name="chevron-down" size={14} color={colors.hint} />
        </View>
      </View>
    );
  }

  return <NativeFilterSelect value={value} options={options} onChange={onChange} disabled={disabled} testID={testID} />;
}

function NativeFilterSelect({
  value,
  options,
  onChange,
  disabled,
  testID,
}: {
  value: string;
  options: FormSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<RNView>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return;
    const onDocClick = (e: MouseEvent) => {
      const node = rootRef.current as unknown as HTMLElement | null;
      if (node && !node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <View ref={rootRef} style={s.nativeFilterWrap}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[s.filterTrigger, disabled && s.filterTriggerDisabled]}
      >
        <Text style={s.filterTriggerTxt} numberOfLines={1}>
          {selected?.label || "Select…"}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.hint} />
      </Pressable>
      {open && (
        <View style={s.filterMenu}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={[s.filterMenuItem, value === opt.value && s.filterMenuItemActive]}
            >
              <Text style={[s.filterMenuTxt, value === opt.value && s.filterMenuTxtActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export const filterSelectSlotStyle = { minWidth: 130, width: 140, flexShrink: 0 as const };

const s = StyleSheet.create({
  filterSelectWrap: { position: "relative" },
  filterChevron: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  nativeFilterWrap: { position: "relative", zIndex: 5 },
  filterTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  filterTriggerDisabled: { backgroundColor: colors.surface2, opacity: 0.85 },
  filterTriggerTxt: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.ink },
  filterMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    zIndex: 20,
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" } as object,
      default: {},
    }),
  },
  filterMenuItem: { paddingHorizontal: 10, paddingVertical: 9 },
  filterMenuItemActive: { backgroundColor: colors.primarySofter },
  filterMenuTxt: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  filterMenuTxtActive: { color: colors.primary, fontWeight: "700" },
});

import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  type View as RNView,
} from "react-native";
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
  /** Compact label styling for filter panels. */
  compact?: boolean;
};

const webSelectStyle: Record<string, string | number> = {
  width: "100%",
  boxSizing: "border-box",
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: colors.border,
  borderRadius: radii.md,
  paddingTop: 12,
  paddingBottom: 12,
  paddingLeft: 14,
  paddingRight: 32,
  fontSize: 15,
  color: colors.ink,
  fontWeight: "500",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
};

const webSelectStyleCompact: Record<string, string | number> = {
  paddingTop: 7,
  paddingBottom: 7,
  paddingLeft: 10,
  paddingRight: 28,
  fontSize: 13,
  borderRadius: radii.sm,
  minHeight: 36,
};

function WebNativeSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  testID,
  compact,
}: Omit<FormSelectProps, "label" | "required">) {
  return (
    <View style={s.webSelectWrap}>
      <select
        data-testid={testID}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...webSelectStyle,
          ...(compact ? webSelectStyleCompact : {}),
          opacity: disabled ? 0.85 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          backgroundColor: disabled ? colors.surface2 : colors.surface,
        }}
      >
        <option value="" disabled hidden>
          {placeholder || "Select…"}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <View style={s.webChevron} pointerEvents="none">
        <Feather name="chevron-down" size={16} color={colors.hint} />
      </View>
    </View>
  );
}

function InlineSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  testID,
  compact,
}: Omit<FormSelectProps, "label" | "required">) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<RNView>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onDocClick = (e: MouseEvent) => {
        const node = rootRef.current as unknown as HTMLElement | null;
        if (node && !node.contains(e.target as Node)) close();
      };
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [open]);

  return (
    <View ref={rootRef} style={s.controlWrap}>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        style={[
          s.trigger,
          compact && s.triggerCompact,
          disabled && s.triggerDisabled,
          open && s.triggerOpen,
        ]}
      >
        <Text style={[s.triggerText, !selected && s.placeholderText]} numberOfLines={1}>
          {selected?.label || placeholder || "Select…"}
        </Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.hint} />
      </Pressable>
      {open && (
        <View style={s.menuInline}>
          <ScrollView style={s.menuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
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
                {value === opt.value && <Feather name="check" size={14} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export function FormSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  required,
  disabled,
  testID,
  compact,
}: FormSelectProps) {
  const controlProps = { value, options, onChange, placeholder, disabled, testID, compact };

  return (
    <View style={s.field}>
      <Text style={[s.label, compact && s.labelCompact]}>
        {label}
        {required ? " *" : ""}
      </Text>
      {Platform.OS === "web" ? (
        <WebNativeSelect {...controlProps} />
      ) : (
        <InlineSelect {...controlProps} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  field: { flex: 1, minWidth: 0, zIndex: 1 },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 8 },
  labelCompact: { fontSize: 11, marginBottom: 6 },
  webSelectWrap: { position: "relative" },
  webChevron: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  controlWrap: { position: "relative", zIndex: 10 },
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
  triggerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    minHeight: 36,
    borderRadius: radii.sm,
  },
  triggerOpen: { borderColor: colors.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  triggerDisabled: { backgroundColor: colors.surface2, opacity: 0.85 },
  triggerText: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: "500" },
  placeholderText: { color: colors.hint, fontWeight: "400" },
  menuInline: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: -1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    maxHeight: 220,
    zIndex: 20,
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" } as object,
      default: {},
    }),
  },
  menuScroll: { maxHeight: 220 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemActive: { backgroundColor: colors.primarySofter },
  menuItemText: { fontSize: 14, color: colors.ink, fontWeight: "500" },
  menuItemTextActive: { color: colors.primary, fontWeight: "700" },
});

import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  type View as RNView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";
import type { FormSelectOption } from "./FormSelect";

type FormMultiSelectProps = {
  label: string;
  values: string[];
  options: FormSelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  testID?: string;
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FormMultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  required,
  disabled,
  testID,
}: FormMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<RNView>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selectedLabels = useMemo(
    () =>
      values
        .map((v) => options.find((o) => o.value === v)?.label || v)
        .filter(Boolean),
    [values, options],
  );

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setQuery("");
    };
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onDocClick = (e: MouseEvent) => {
        const node = rootRef.current as unknown as HTMLElement | null;
        if (node && !node.contains(e.target as Node)) close();
      };
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
  }, [open]);

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2} more`;

  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      <View ref={rootRef} style={s.controlWrap}>
        <Pressable
          testID={testID}
          disabled={disabled}
          onPress={() => setOpen((v) => !v)}
          style={[s.trigger, disabled && s.triggerDisabled, open && s.triggerOpen]}
        >
          <Text
            style={[s.triggerText, selectedLabels.length === 0 && s.placeholderText]}
            numberOfLines={1}
          >
            {summary}
          </Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.hint} />
        </Pressable>

        {selectedLabels.length > 0 && (
          <View style={s.chipRow}>
            {values.map((val) => {
              const lbl = options.find((o) => o.value === val)?.label || val;
              return (
                <View key={val} style={s.chip}>
                  <Text style={s.chipTxt}>{lbl}</Text>
                  {!disabled && (
                    <Pressable
                      testID={testID ? `${testID}-remove-${val}` : undefined}
                      hitSlop={8}
                      onPress={() => onChange(values.filter((v) => v !== val))}
                    >
                      <Feather name="x" size={12} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {open && (
          <View style={s.menu}>
            <View style={s.searchWrap}>
              <Feather name="search" size={14} color={colors.hint} />
              <TextInput
                testID={testID ? `${testID}-search` : undefined}
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.hint}
                style={s.searchInput}
                autoFocus={Platform.OS === "web"}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Feather name="x" size={14} color={colors.hint} />
                </Pressable>
              )}
            </View>
            <ScrollView style={s.menuScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={s.empty}>No matches</Text>
              ) : (
                filtered.map((opt) => {
                  const checked = values.includes(opt.value);
                  return (
                    <Pressable
                      key={opt.value}
                      testID={testID ? `${testID}-opt-${opt.value}` : undefined}
                      onPress={() => onChange(toggleValue(values, opt.value))}
                      style={[s.menuItem, checked && s.menuItemActive]}
                    >
                      <View style={[s.checkBox, checked && s.checkBoxActive]}>
                        {checked && <Feather name="check" size={12} color="#fff" />}
                      </View>
                      <Text style={[s.menuItemText, checked && s.menuItemTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  field: { flex: 1, minWidth: 0, zIndex: 1 },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 8 },
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
  triggerOpen: { borderColor: colors.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  triggerDisabled: { backgroundColor: colors.surface2, opacity: 0.85 },
  triggerText: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: "500" },
  placeholderText: { color: colors.hint, fontWeight: "400" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipTxt: { fontSize: 12, fontWeight: "600", color: colors.ink },
  menu: {
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
    maxHeight: 280,
    zIndex: 20,
    ...Platform.select({
      web: { boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" } as object,
      default: {},
    }),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  menuScroll: { maxHeight: 220 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemActive: { backgroundColor: colors.primarySofter },
  menuItemText: { fontSize: 14, color: colors.ink, fontWeight: "500", flex: 1 },
  menuItemTextActive: { color: colors.primary, fontWeight: "700" },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  empty: { padding: 14, fontSize: 13, color: colors.muted2, textAlign: "center" },
});

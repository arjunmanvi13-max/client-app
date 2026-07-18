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

type FormSearchSelectProps = {
  label: string;
  value: string;
  options: FormSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  testID?: string;
};

export function FormSearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  required,
  disabled,
  testID,
}: FormSearchSelectProps) {
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

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label || "",
    [options, value],
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
            style={[s.triggerText, !selectedLabel && s.placeholderText]}
            numberOfLines={1}
          >
            {selectedLabel || placeholder}
          </Text>
          <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.hint} />
        </Pressable>

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
                  const checked = value === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      testID={testID ? `${testID}-opt-${opt.value}` : undefined}
                      onPress={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setQuery("");
                      }}
                      style={[s.menuItem, checked && s.menuItemActive]}
                    >
                      <Text style={[s.menuItemText, checked && s.menuItemTextActive]}>
                        {opt.label}
                      </Text>
                      {checked && <Feather name="check" size={14} color={colors.primary} />}
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
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemActive: { backgroundColor: colors.primarySofter },
  menuItemText: { fontSize: 14, color: colors.ink, fontWeight: "500", flex: 1 },
  menuItemTextActive: { color: colors.primary, fontWeight: "700" },
  empty: { padding: 14, fontSize: 13, color: colors.muted2, textAlign: "center" },
});

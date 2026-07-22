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

const MENU_Z = 1000;

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
  /** Notifies parent when the menu opens/closes so wrappers can raise stacking order. */
  onOpenChange?: (open: boolean) => void;
  /** Compact label + trigger sizing for dense forms. */
  compact?: boolean;
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
  onOpenChange,
  compact,
}: FormSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<RNView>(null);

  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
    onOpenChange?.(next);
  };

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
    const close = () => setMenuOpen(false);
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
    <View style={[s.field, open && s.fieldOpen]}>
      <Text style={[s.label, compact && s.labelCompact]}>
        {label}
        {required ? " *" : ""}
      </Text>
      <View ref={rootRef} style={[s.controlWrap, open && s.controlWrapOpen]}>
        <Pressable
          testID={testID}
          disabled={disabled}
          onPress={() => setMenuOpen(!open)}
          style={[s.trigger, compact && s.triggerCompact, disabled && s.triggerDisabled, open && s.triggerOpen]}
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
              <Feather name="search" size={14} color={colors.muted} />
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
            <ScrollView
              style={s.menuScroll}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
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
                        setMenuOpen(false);
                      }}
                      style={({ pressed, hovered }) => [
                        s.menuItem,
                        checked && s.menuItemActive,
                        Platform.OS === "web" && hovered && !checked ? s.menuItemHover : null,
                        pressed ? s.menuItemPressed : null,
                      ]}
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
  field: { flex: 1, minWidth: 0 },
  fieldOpen: { zIndex: MENU_Z, elevation: MENU_Z },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 6 },
  labelCompact: { fontSize: 11, marginBottom: 4 },
  controlWrap: { position: "relative" },
  controlWrapOpen: { zIndex: MENU_Z, elevation: MENU_Z },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  triggerOpen: { borderColor: colors.primary, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  triggerDisabled: { backgroundColor: colors.surface2, opacity: 0.85 },
  triggerText: { flex: 1, fontSize: 14, color: colors.ink, fontWeight: "600" },
  placeholderText: { color: colors.muted2, fontWeight: "400" },
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
    maxHeight: 260,
    zIndex: MENU_Z + 1,
    elevation: MENU_Z + 1,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)",
        isolation: "isolate",
      } as object,
      default: {},
    }),
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    fontWeight: "500",
    paddingVertical: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  menuScroll: { maxHeight: 200 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  menuItemHover: { backgroundColor: colors.primarySofter },
  menuItemPressed: { backgroundColor: colors.primarySoft },
  menuItemActive: { backgroundColor: colors.primarySoft },
  menuItemText: { fontSize: 14, color: colors.ink, fontWeight: "600", flex: 1 },
  menuItemTextActive: { color: colors.primary, fontWeight: "700" },
  empty: { padding: 12, fontSize: 13, color: colors.muted2, textAlign: "center" },
});

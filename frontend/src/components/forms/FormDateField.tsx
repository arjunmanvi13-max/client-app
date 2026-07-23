import { createElement, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  type TextInputProps,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  DATE_PLACEHOLDER,
  formatDate,
  maskDisplayDateInput,
  parseToISO,
} from "../../dateFormat";
import { colors, radii } from "../../theme";

type FormDateFieldProps = Omit<TextInputProps, "value" | "onChangeText"> & {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  readOnly?: boolean;
  compact?: boolean;
};

export function FormDateField({
  label,
  required,
  hint,
  value,
  onChangeText,
  readOnly,
  compact,
  testID,
  ...rest
}: FormDateFieldProps) {
  const nativeDateRef = useRef<HTMLInputElement | null>(null);

  const handleTextChange = (text: string) => {
    onChangeText(maskDisplayDateInput(text));
  };

  const openPicker = () => {
    if (readOnly) return;
    if (Platform.OS === "web") {
      const el = nativeDateRef.current;
      if (!el) return;
      if (typeof el.showPicker === "function") el.showPicker();
      else el.click();
      return;
    }
  };

  return (
    <View style={[s.wrap, compact && s.wrapCompact]}>
      {label ? (
        <Text style={[s.label, compact && s.labelCompact]}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <View style={[s.inputWrap, compact && s.inputWrapCompact, readOnly && s.inputWrapReadonly]}>
        <TextInput
          {...rest}
          testID={testID}
          value={value}
          onChangeText={handleTextChange}
          editable={rest.editable !== false && !readOnly}
          placeholder={DATE_PLACEHOLDER}
          placeholderTextColor={colors.hint}
          keyboardType="number-pad"
          maxLength={10}
          style={[
            s.input,
            compact && s.inputCompact,
            s.inputWithTrailing,
            compact && s.inputWithTrailingCompact,
            readOnly && s.inputReadonly,
          ]}
        />
        <Pressable
          onPress={openPicker}
          disabled={readOnly}
          style={({ pressed }) => [
            s.trailingIconBtn,
            compact && s.trailingIconBtnCompact,
            pressed && !readOnly && s.iconBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Open calendar for ${label}`}
          testID={testID ? `${testID}-calendar` : undefined}
        >
          <Feather name="calendar" size={compact ? 14 : 16} color={readOnly ? colors.hint : colors.muted} />
        </Pressable>
        {Platform.OS === "web" && !readOnly
          ? createElement("input", {
              ref: nativeDateRef,
              type: "date",
              value: parseToISO(value) || "",
              onChange: (e: { target: { value: string } }) => {
                const iso = e.target?.value;
                if (iso) onChangeText(formatDate(iso));
              },
              tabIndex: -1,
              "aria-hidden": true,
              style: {
                position: "absolute",
                top: 0,
                right: 0,
                width: compact ? 32 : 40,
                height: "100%",
                opacity: 0,
                border: "none",
                padding: 0,
                margin: 0,
                cursor: "pointer",
              },
            })
          : null}
      </View>
      {hint ? <Text style={[s.fieldHint, compact && s.fieldHintCompact]}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8, width: "100%", minWidth: 0 },
  wrapCompact: { gap: 4 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.2 },
  labelCompact: { fontSize: 10, letterSpacing: 0.15 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    minHeight: 46,
    width: "100%",
    position: "relative",
    overflow: "hidden",
    ...Platform.select({
      web: {
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      } as object,
      default: {},
    }),
  },
  inputWrapCompact: { minHeight: 36, borderRadius: radii.sm },
  inputWrapReadonly: { backgroundColor: colors.surface2 },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  inputCompact: { paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  inputWithTrailing: { paddingRight: 40 },
  inputWithTrailingCompact: { paddingRight: 32 },
  inputReadonly: { color: colors.muted2 },
  trailingIconBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  trailingIconBtnCompact: { width: 32 },
  iconBtnPressed: { opacity: 0.65 },
  fieldHint: { fontSize: 11, color: colors.hint, lineHeight: 15 },
  fieldHintCompact: { fontSize: 10, lineHeight: 13 },
});

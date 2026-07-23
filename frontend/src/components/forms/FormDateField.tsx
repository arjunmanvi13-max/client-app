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
};

export function FormDateField({
  label,
  required,
  hint,
  value,
  onChangeText,
  readOnly,
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
    <View style={s.wrap}>
      {label ? (
        <Text style={s.label}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <View style={[s.inputWrap, readOnly && s.inputWrapReadonly]}>
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
          style={[s.input, readOnly && s.inputReadonly]}
        />
        <Pressable
          onPress={openPicker}
          disabled={readOnly}
          style={({ pressed }) => [s.iconBtn, pressed && !readOnly && s.iconBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Open calendar for ${label}`}
          testID={testID ? `${testID}-calendar` : undefined}
        >
          <Feather name="calendar" size={16} color={readOnly ? colors.hint : colors.muted} />
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
              style: {
                position: "absolute",
                opacity: 0,
                width: 1,
                height: 1,
                right: 8,
                bottom: 8,
                pointerEvents: "none",
              },
            })
          : null}
      </View>
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.2 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    minHeight: 46,
    position: "relative",
    ...Platform.select({
      web: {
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      } as object,
      default: {},
    }),
  },
  inputWrapReadonly: { backgroundColor: colors.surface2 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingRight: 8,
    fontSize: 15,
    color: colors.ink,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  inputReadonly: { color: colors.muted2 },
  iconBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  iconBtnPressed: { opacity: 0.65 },
  fieldHint: { fontSize: 11, color: colors.hint, lineHeight: 15 },
});

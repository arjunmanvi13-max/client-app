import { View, Text, TextInput, StyleSheet, Platform, type TextInputProps } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";

type FormTextFieldProps = TextInputProps & {
  label: string;
  required?: boolean;
  hint?: string;
  leadingIcon?: keyof typeof Feather.glyphMap;
  trailingIcon?: keyof typeof Feather.glyphMap;
  multiline?: boolean;
  readOnly?: boolean;
  compact?: boolean;
};

export function FormTextField({
  label,
  required,
  hint,
  leadingIcon,
  trailingIcon,
  multiline,
  readOnly,
  compact,
  style,
  ...rest
}: FormTextFieldProps) {
  return (
    <View style={[s.wrap, compact && s.wrapCompact]}>
      {label ? (
        <Text style={[s.label, compact && s.labelCompact]}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <View style={[
        s.inputWrap,
        compact && !multiline && s.inputWrapCompact,
        multiline && (compact ? s.inputWrapMultilineCompact : s.inputWrapMultiline),
        readOnly && s.inputWrapReadonly,
      ]}>
        {leadingIcon && (
          <Feather
            name={leadingIcon}
            size={compact ? 14 : 16}
            color={colors.hint}
            style={[s.leadingIcon, compact && s.leadingIconCompact]}
          />
        )}
        <TextInput
          {...rest}
          editable={rest.editable !== false && !readOnly}
          multiline={multiline}
          placeholderTextColor={colors.hint}
          style={[
            s.input,
            compact && s.inputCompact,
            leadingIcon && s.inputWithLeading,
            trailingIcon && s.inputWithTrailing,
            multiline && (compact ? s.inputMultilineCompact : s.inputMultiline),
            readOnly && s.inputReadonly,
            style,
          ]}
        />
        {trailingIcon && (
          <Feather
            name={trailingIcon}
            size={compact ? 14 : 16}
            color={colors.hint}
            style={[s.trailingIcon, compact && s.trailingIconCompact]}
          />
        )}
      </View>
      {hint ? <Text style={[s.hint, compact && s.hintCompact]}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
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
    ...Platform.select({
      web: {
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      } as object,
      default: {},
    }),
  },
  inputWrapCompact: { minHeight: 36, borderRadius: radii.sm },
  inputWrapMultiline: { alignItems: "flex-start", minHeight: 108 },
  inputWrapMultilineCompact: { alignItems: "flex-start", minHeight: 56 },
  inputWrapReadonly: { backgroundColor: colors.surface2 },
  leadingIcon: { marginLeft: 14 },
  leadingIconCompact: { marginLeft: 10 },
  trailingIcon: { marginRight: 14 },
  trailingIconCompact: { marginRight: 10 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  inputCompact: { paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  inputWithLeading: { paddingLeft: 8 },
  inputWithTrailing: { paddingRight: 8 },
  inputMultiline: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
  inputMultilineCompact: { minHeight: 52, textAlignVertical: "top", paddingTop: 8 },
  inputReadonly: { color: colors.muted2 },
  hint: { fontSize: 11, color: colors.hint, lineHeight: 15 },
  hintCompact: { fontSize: 10, lineHeight: 13 },
});

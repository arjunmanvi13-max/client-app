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
};

export function FormTextField({
  label,
  required,
  hint,
  leadingIcon,
  trailingIcon,
  multiline,
  readOnly,
  style,
  ...rest
}: FormTextFieldProps) {
  return (
    <View style={s.wrap}>
      {label ? (
        <Text style={s.label}>
          {label}
          {required ? " *" : ""}
        </Text>
      ) : null}
      <View style={[s.inputWrap, multiline && s.inputWrapMultiline, readOnly && s.inputWrapReadonly]}>
        {leadingIcon && (
          <Feather name={leadingIcon} size={16} color={colors.hint} style={s.leadingIcon} />
        )}
        <TextInput
          {...rest}
          editable={rest.editable !== false && !readOnly}
          multiline={multiline}
          placeholderTextColor={colors.hint}
          style={[
            s.input,
            leadingIcon && s.inputWithLeading,
            trailingIcon && s.inputWithTrailing,
            multiline && s.inputMultiline,
            readOnly && s.inputReadonly,
            style,
          ]}
        />
        {trailingIcon && (
          <Feather name={trailingIcon} size={16} color={colors.hint} style={s.trailingIcon} />
        )}
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
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
    ...Platform.select({
      web: {
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
      } as object,
      default: {},
    }),
  },
  inputWrapMultiline: { alignItems: "flex-start", minHeight: 108 },
  inputWrapReadonly: { backgroundColor: colors.surface2 },
  leadingIcon: { marginLeft: 14 },
  trailingIcon: { marginRight: 14 },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  inputWithLeading: { paddingLeft: 8 },
  inputWithTrailing: { paddingRight: 8 },
  inputMultiline: { minHeight: 96, textAlignVertical: "top", paddingTop: 12 },
  inputReadonly: { color: colors.muted2 },
  hint: { fontSize: 11, color: colors.hint, lineHeight: 15 },
});

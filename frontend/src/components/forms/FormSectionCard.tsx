import { View, Text, StyleSheet, Platform, type ReactNode, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../theme";

type FormSectionCardProps = {
  title?: string;
  overline?: string;
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export function FormSectionCard({ title, overline, children, style, testID }: FormSectionCardProps) {
  return (
    <View style={[s.card, style]} testID={testID}>
      {overline ? <Text style={s.overline}>{overline}</Text> : null}
      {title ? <Text style={s.title}>{title}</Text> : null}
      <View style={s.body}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    ...Platform.select({
      web: { boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)" } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
    }),
  },
  overline: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
    marginBottom: spacing.md,
  },
  body: { gap: spacing.lg },
});

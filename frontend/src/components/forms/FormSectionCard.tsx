import { View, Text, StyleSheet, Platform, type ReactNode, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "../../theme";

type FormSectionCardProps = {
  title?: string;
  overline?: string;
  children: ReactNode;
  style?: ViewStyle;
  testID?: string;
  compact?: boolean;
};

export function FormSectionCard({ title, overline, children, style, testID, compact }: FormSectionCardProps) {
  return (
    <View style={[s.card, compact && s.cardCompact, style]} testID={testID}>
      {overline ? <Text style={[s.overline, compact && s.overlineCompact]}>{overline}</Text> : null}
      {title ? <Text style={[s.title, compact && s.titleCompact]}>{title}</Text> : null}
      <View style={[s.body, compact && s.bodyCompact]}>{children}</View>
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
  cardCompact: {
    padding: 14,
    marginBottom: 0,
    borderRadius: radii.lg,
    flex: 1,
    minWidth: 0,
    ...Platform.select({
      web: { boxShadow: "0 1px 6px rgba(15, 23, 42, 0.05)" } as object,
      default: {},
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
  overlineCompact: { fontSize: 9, letterSpacing: 1, marginBottom: 6 },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.2,
    marginBottom: spacing.md,
  },
  titleCompact: { fontSize: 13, marginBottom: 8 },
  body: { gap: spacing.lg },
  bodyCompact: { gap: 8 },
});

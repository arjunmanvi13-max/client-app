import { View, Text, StyleSheet, type ReactNode } from "react-native";
import { colors, radii, spacing } from "../../theme";

export function FormSectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.title}>{title}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: 0.2,
    marginBottom: spacing.xs,
  },
});

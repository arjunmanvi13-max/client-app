import { View, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../theme";

export function DirectoryListSkeleton({ rows = 6, testID = "directory-skeleton" }: { rows?: number; testID?: string }) {
  return (
    <View style={s.wrap} testID={testID}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={s.row}>
          <View style={s.avatar} />
          <View style={s.body}>
            <View style={[s.bar, s.barName]} />
            <View style={[s.bar, s.barMeta]} />
            <View style={s.pills}>
              <View style={s.pill} />
              <View style={s.pill} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8, padding: spacing.md },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.borderSoft,
  },
  body: { flex: 1, gap: 6, paddingTop: 2 },
  bar: {
    height: 10,
    borderRadius: radii.sm,
    backgroundColor: colors.borderSoft,
  },
  barName: { width: "42%" },
  barMeta: { width: "64%", height: 8 },
  pills: { flexDirection: "row", gap: 6, marginTop: 2 },
  pill: {
    width: 56,
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.borderSoft,
  },
});

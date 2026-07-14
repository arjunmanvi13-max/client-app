import { View, StyleSheet, type ReactNode } from "react-native";
import { spacing } from "../../theme";

type FormFieldGridProps = {
  columns: 2 | 3 | 4;
  isWide: boolean;
  children: ReactNode;
};

export function FormFieldGrid({ columns, isWide, children }: FormFieldGridProps) {
  const items = Array.isArray(children) ? children : [children];
  const basis = isWide ? `${100 / columns}%` : "100%";

  return (
    <View style={[s.row, isWide && s.rowWide]}>
      {items.map((child, i) => (
        <View
          key={i}
          style={[
            s.col,
            isWide && {
              flexGrow: 0,
              flexShrink: 0,
              flexBasis: basis,
              maxWidth: basis,
              paddingRight: i % columns === columns - 1 ? 0 : spacing.sm,
            },
          ]}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { gap: spacing.md },
  rowWide: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  col: { width: "100%" },
});

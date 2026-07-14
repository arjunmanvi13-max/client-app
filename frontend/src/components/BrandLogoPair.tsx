import { View, Text, Image, StyleSheet, type ImageStyle, type ViewStyle } from "react-native";
import { colors } from "../theme";

export const PWS_LOGO = require("../../assets/pws-logo.png");
export const ALPHA_LOGO = require("../../assets/alpha-sports-logo.png");

type BrandLogoPairProps = {
  size?: number;
  gap?: number;
  showSeparator?: boolean;
  separatorColor?: string;
  wrapStyle?: ViewStyle;
  logoStyle?: ImageStyle;
  testID?: string;
};

/** PWS and ALPHA logos displayed side by side. */
export function BrandLogoPair({
  size = 44,
  gap = 8,
  showSeparator = false,
  separatorColor = colors.muted,
  wrapStyle,
  logoStyle,
  testID = "brand-logos",
}: BrandLogoPairProps) {
  const imgStyle: ImageStyle = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.22),
    ...logoStyle,
  };

  return (
    <View style={[s.row, { gap }, wrapStyle]} testID={testID}>
      <Image source={PWS_LOGO} style={imgStyle} resizeMode="contain" testID="pws-logo" accessibilityLabel="Prarambhika World School logo" />
      {showSeparator && <Text style={[s.sep, { color: separatorColor, fontSize: size * 0.38 }]}>×</Text>}
      <Image source={ALPHA_LOGO} style={imgStyle} resizeMode="contain" testID="alpha-logo" accessibilityLabel="ALPHA Sports Academy logo" />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  sep: { fontWeight: "300" },
});

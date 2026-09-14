import { View, Text, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadow } from "../../theme";
import { feeBadgeStyle, inr, playerInitials, playerMeta } from "./feesUi";
import type { CollectionPlayer, Institution } from "../../feesCollectionTypes";

export function PlayerFeeRow({
  player,
  institution,
  selectMode,
  selected,
  onToggleSelect,
  onCollect,
}: {
  player: CollectionPlayer;
  institution: Institution;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onCollect: () => void;
}) {
  const badge = feeBadgeStyle(player.fee_status);
  const meta = playerMeta(player, institution);

  return (
    <View style={s.card} testID={`player-row-${player.id}`}>
      {selectMode && (
        <Pressable onPress={onToggleSelect} style={s.selectBox} testID={`select-${player.id}`}>
          <View style={[s.checkbox, selected && s.checkboxOn]}>
            {selected && <Feather name="check" size={11} color="#fff" />}
          </View>
        </Pressable>
      )}
      <View style={s.avatar}><Text style={s.avatarTxt}>{playerInitials(player.name)}</Text></View>
      <View style={s.main}>
        <Text style={s.name} numberOfLines={1}>{player.name}</Text>
        <Text style={s.sub} numberOfLines={1}>{meta || player.mobile || "—"}</Text>
      </View>
      <View style={[s.badge, { backgroundColor: badge.bg }]}>
        <Text style={[s.badgeTxt, { color: badge.fg }]}>{player.badge}</Text>
      </View>
      <Text style={s.amount}>{inr(player.amount_due)}</Text>
      <TouchableOpacity
        style={[s.collectBtn, institution === "ALPHA" && s.collectBtnAlpha]}
        onPress={onCollect}
        testID={`collect-${player.id}`}
      >
        <Text style={s.collectTxt}>Collect Fee</Text>
      </TouchableOpacity>
    </View>
  );
}

export function PlayerListSkeleton() {
  return (
    <View testID="player-list-skeleton" style={{ gap: 8 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[s.card, s.skeleton]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...shadow.sm,
  },
  skeleton: { height: 64, backgroundColor: colors.surface2 },
  selectBox: { padding: 2 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
  amount: { fontSize: 14, fontWeight: "800", color: colors.ink, minWidth: 72, textAlign: "right" },
  collectBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm,
  },
  collectBtnAlpha: { backgroundColor: colors.accent },
  collectTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

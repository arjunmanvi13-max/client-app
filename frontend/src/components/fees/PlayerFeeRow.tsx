import { View, Text, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../../theme";
import type { CollectionPlayer, Institution } from "../../feesCollectionTypes";

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function initials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function badgeStyle(status: CollectionPlayer["fee_status"]) {
  if (status === "paid" || status === "paid_ahead") return { bg: "#DCFCE7", fg: "#16A34A" };
  if (status === "overdue") return { bg: "#FEE2E2", fg: "#DC2626" };
  return { bg: "#FEF3C7", fg: "#D97706" };
}

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
  const badge = badgeStyle(player.fee_status);
  const meta = institution === "PWS"
    ? [player.pws_class || player.group, player.is_resident ? "Hostel" : "Day Scholar"].filter(Boolean).join(" · ")
    : [player.centre, player.sport, player.player_type].filter(Boolean).join(" · ");

  return (
    <View style={s.row} testID={`player-row-${player.id}`}>
      {selectMode && (
        <Pressable onPress={onToggleSelect} style={s.selectBox} testID={`select-${player.id}`}>
          <View style={[s.checkbox, selected && s.checkboxOn]}>
            {selected && <Feather name="check" size={12} color="#fff" />}
          </View>
        </Pressable>
      )}
      <View style={s.avatar}><Text style={s.avatarTxt}>{initials(player.name)}</Text></View>
      <View style={s.main}>
        <Text style={s.name}>{player.name}</Text>
        {player.mobile ? <Text style={s.mobile}>{player.mobile}</Text> : null}
        <Text style={s.meta}>{meta || "—"}</Text>
        <View style={[s.badge, { backgroundColor: badge.bg }]}>
          <Text style={[s.badgeTxt, { color: badge.fg }]}>{player.badge}</Text>
        </View>
      </View>
      <View style={s.right}>
        <Text style={s.amount}>{inr(player.amount_due)}</Text>
        <TouchableOpacity style={s.collectBtn} onPress={onCollect} testID={`collect-${player.id}`}>
          <Text style={s.collectTxt}>Collect</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function PlayerListSkeleton() {
  return (
    <View testID="player-list-skeleton">
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[s.row, s.skeleton]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  skeleton: { height: 88, backgroundColor: colors.surface2 },
  selectBox: { padding: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: "700", color: colors.ink },
  mobile: { fontSize: 12, color: colors.muted, marginTop: 1 },
  meta: { fontSize: 11, color: colors.hint, marginTop: 2 },
  badge: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
  right: { alignItems: "flex-end", gap: 8 },
  amount: { fontSize: 15, fontWeight: "800", color: colors.ink },
  collectBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  collectTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
});

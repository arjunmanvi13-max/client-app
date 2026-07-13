import { View, Text, Pressable, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii } from "../../theme";
import { feeBadgeStyle, inr, playerInitials, playerMeta } from "./feesUi";
import type { CollectionPlayer, Institution } from "../../feesCollectionTypes";

type Props = {
  players: CollectionPlayer[];
  institution: Institution;
  selectMode?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onCollect: (p: CollectionPlayer) => void;
};

export function PlayerFeeTable({
  players, institution, selectMode, selectedIds, onToggleSelect, onCollect,
}: Props) {
  return (
    <View style={s.table} testID="player-fee-table">
      <View style={[s.tr, s.thead]}>
        {selectMode && <View style={s.colCheck} />}
        <Text style={[s.th, s.colPlayer]}>Player</Text>
        <Text style={[s.th, s.colMeta]}>{institution === "PWS" ? "Class / Type" : "Centre / Sport"}</Text>
        <Text style={[s.th, s.colStatus]}>Status</Text>
        <Text style={[s.th, s.colAmt, s.right]}>Amount Due</Text>
        <View style={s.colAction} />
      </View>
      {players.map((p, idx) => {
        const badge = feeBadgeStyle(p.fee_status);
        const selected = selectedIds.has(p.id);
        const meta = playerMeta(p, institution);
        return (
          <View
            key={p.id}
            style={[s.tr, s.tbody, idx % 2 === 1 && s.striped]}
            testID={`player-row-${p.id}`}
          >
            {selectMode && (
              <Pressable onPress={() => onToggleSelect(p.id)} style={s.colCheck} testID={`select-${p.id}`}>
                <View style={[s.checkbox, selected && s.checkboxOn]}>
                  {selected && <Feather name="check" size={11} color="#fff" />}
                </View>
              </Pressable>
            )}
            <View style={[s.colPlayer, s.playerCell]}>
              <View style={s.avatar}><Text style={s.avatarTxt}>{playerInitials(p.name)}</Text></View>
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                <Text style={s.mobile} numberOfLines={1}>{p.mobile || "—"}</Text>
              </View>
            </View>
            <Text style={[s.td, s.colMeta]} numberOfLines={2}>{meta || "—"}</Text>
            <View style={s.colStatus}>
              <View style={[s.badge, { backgroundColor: badge.bg }]}>
                <Text style={[s.badgeTxt, { color: badge.fg }]}>{p.badge}</Text>
              </View>
            </View>
            <Text style={[s.td, s.colAmt, s.amt, s.right]}>{inr(p.amount_due)}</Text>
            <View style={s.colAction}>
              <TouchableOpacity style={s.collectBtn} onPress={() => onCollect(p)} testID={`collect-${p.id}`}>
                <Text style={s.collectTxt}>Collect</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function TableSkeleton() {
  return (
    <View style={s.table} testID="player-list-skeleton">
      <View style={[s.tr, s.thead, { height: 36 }]} />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View key={i} style={[s.tr, s.tbody, s.skeletonRow, i % 2 === 1 && s.striped]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  table: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tr: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 },
  thead: {
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  tbody: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  striped: { backgroundColor: "#FAFBFC" },
  th: { fontSize: 10, fontWeight: "800", color: colors.hint, letterSpacing: 0.6, textTransform: "uppercase" },
  td: { fontSize: 13, color: colors.ink },
  colCheck: { width: 28 },
  colPlayer: { flex: 2.2, minWidth: 140 },
  colMeta: { flex: 1.6, minWidth: 100 },
  colStatus: { flex: 1, minWidth: 88 },
  colAmt: { flex: 1, minWidth: 90 },
  colAction: { width: 76, alignItems: "flex-end" },
  right: { textAlign: "right" },
  playerCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  avatarTxt: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  name: { fontSize: 13, fontWeight: "700", color: colors.ink },
  mobile: { fontSize: 11, color: colors.muted, marginTop: 1 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
  amt: { fontWeight: "800", fontSize: 14 },
  collectBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  collectTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  skeletonRow: { height: 44, backgroundColor: colors.surface2 },
});

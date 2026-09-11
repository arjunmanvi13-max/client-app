import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadow } from "./theme";
import {
  ACCESS_LEVELS,
  MODULE_MATRIX,
  type ModuleAccessLevel,
} from "./designationAccess";

type Props = {
  visible: boolean;
  title?: string;
  access: Record<string, ModuleAccessLevel>;
  onChange: (moduleId: string, level: ModuleAccessLevel) => void;
  onClose: () => void;
  onResetPreset?: () => void;
};

export function ModulePermissionMatrix({
  visible,
  title = "Module permissions",
  access,
  onChange,
  onClose,
  onResetPreset,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.sub}>Override designation defaults per module</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} testID="perm-matrix-close">
              <Feather name="x" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={s.body}>
            <View style={s.legend}>
              {ACCESS_LEVELS.map((lvl) => (
                <Text key={lvl.code} style={s.legendTxt}>{lvl.label}</Text>
              ))}
            </View>
            {MODULE_MATRIX.map((mod) => (
              <View key={mod.id} style={s.row} testID={`perm-mod-${mod.id}`}>
                <Text style={s.modLabel}>{mod.label}</Text>
                <View style={s.levels}>
                  {ACCESS_LEVELS.map((lvl) => {
                    const on = (access[mod.id] || "none") === lvl.code;
                    return (
                      <TouchableOpacity
                        key={lvl.code}
                        testID={`perm-${mod.id}-${lvl.code}`}
                        style={[s.lvl, on && s.lvlOn, on && lvl.code === "none" && s.lvlNone, on && lvl.code === "view" && s.lvlView, on && lvl.code === "edit" && s.lvlEdit, on && lvl.code === "admin" && s.lvlAdmin]}
                        onPress={() => onChange(mod.id, lvl.code)}
                      >
                        <Text style={[s.lvlTxt, on && s.lvlTxtOn]}>{lvl.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={s.foot}>
            {onResetPreset && (
              <TouchableOpacity onPress={onResetPreset} style={s.resetBtn} testID="perm-reset-preset">
                <Text style={s.resetTxt}>Reset to designation default</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={s.doneBtn} testID="perm-matrix-done">
              <Text style={s.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: "#fff", borderRadius: radii.xl, maxHeight: "90%", ...shadow.md },
  head: { flexDirection: "row", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  body: { padding: 16, gap: 12 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  legendTxt: { fontSize: 10, fontWeight: "700", color: colors.hint, textTransform: "uppercase" },
  row: { gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  modLabel: { fontSize: 13, fontWeight: "800", color: colors.ink2 },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  lvl: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  lvlOn: { borderColor: colors.primary },
  lvlNone: { backgroundColor: "#F1F5F9" },
  lvlView: { backgroundColor: "#E0F7FC" },
  lvlEdit: { backgroundColor: "#FEF3C7" },
  lvlAdmin: { backgroundColor: "#D1FAE5" },
  lvlTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  lvlTxtOn: { color: colors.ink },
  foot: { flexDirection: "row", justifyContent: "flex-end", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  resetBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  resetTxt: { fontSize: 13, fontWeight: "700", color: colors.primary },
  doneBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.md },
  doneTxt: { color: "#fff", fontWeight: "800" },
});

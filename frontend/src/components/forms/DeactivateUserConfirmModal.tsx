import {
  View, Text, Modal, Pressable, StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadow, spacing } from "../../theme";

type Props = {
  visible: boolean;
  loading?: boolean;
  onYes: () => void;
  onNo: () => void;
};

export function DeactivateUserConfirmModal({ visible, loading, onYes, onNo }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onNo}>
      <Pressable style={s.backdrop} onPress={loading ? undefined : onNo}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <View style={s.iconWrap}>
            <Feather name="user-x" size={22} color={colors.danger} />
          </View>
          <Text style={s.message}>Are you sure you want to Deactivate the user?</Text>
          <View style={s.actions}>
            <Pressable
              testID="deactivate-user-no-btn"
              style={[s.noBtn, loading && s.btnDisabled]}
              onPress={onNo}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="No, cancel deactivation"
            >
              <Text style={s.noTxt}>No</Text>
            </Pressable>
            <Pressable
              testID="deactivate-user-yes-btn"
              style={[s.yesBtn, loading && s.btnDisabled]}
              onPress={onYes}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Yes, deactivate user"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.yesTxt}>Yes</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    ...shadow.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  noBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 72,
    alignItems: "center",
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  noTxt: { fontSize: 14, fontWeight: "700", color: colors.ink },
  yesBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: colors.danger,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  yesTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
  btnDisabled: { opacity: 0.65 },
});

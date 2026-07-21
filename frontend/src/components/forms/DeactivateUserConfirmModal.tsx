import {
  View, Text, Modal, Pressable, StyleSheet, Platform, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadow, spacing } from "../../theme";

export type UserStatusConfirmAction = "deactivate" | "reactivate";

type Props = {
  visible: boolean;
  action: UserStatusConfirmAction;
  loading?: boolean;
  onYes: () => void;
  onNo: () => void;
};

const COPY: Record<UserStatusConfirmAction, { message: string; icon: "user-x" | "user-check"; yesLabel: string; noLabel: string }> = {
  deactivate: {
    message: "Are you sure you want to Deactivate the user?",
    icon: "user-x",
    yesLabel: "Yes, deactivate user",
    noLabel: "No, cancel deactivation",
  },
  reactivate: {
    message: "Are you sure you want to Reactivate the user?",
    icon: "user-check",
    yesLabel: "Yes, reactivate user",
    noLabel: "No, cancel reactivation",
  },
};

export function DeactivateUserConfirmModal({ visible, action, loading, onYes, onNo }: Props) {
  const copy = COPY[action];
  const isReactivate = action === "reactivate";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onNo}>
      <Pressable style={s.backdrop} onPress={loading ? undefined : onNo}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <View style={[s.iconWrap, isReactivate && s.iconWrapSuccess]}>
            <Feather name={copy.icon} size={22} color={isReactivate ? colors.success : colors.danger} />
          </View>
          <Text style={s.message}>{copy.message}</Text>
          <View style={s.actions}>
            <Pressable
              testID={`${action}-user-no-btn`}
              style={[s.noBtn, loading && s.btnDisabled]}
              onPress={onNo}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={copy.noLabel}
            >
              <Text style={s.noTxt}>No</Text>
            </Pressable>
            <Pressable
              testID={`${action}-user-yes-btn`}
              style={[s.yesBtn, isReactivate && s.yesBtnSuccess, loading && s.btnDisabled]}
              onPress={onYes}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={copy.yesLabel}
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
  iconWrapSuccess: {
    backgroundColor: colors.successSoft,
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
  yesBtnSuccess: {
    backgroundColor: colors.success,
  },
  yesTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
  btnDisabled: { opacity: 0.65 },
});

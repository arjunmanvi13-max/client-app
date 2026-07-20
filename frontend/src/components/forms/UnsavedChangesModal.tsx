import {
  View, Text, Modal, Pressable, StyleSheet, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, shadow, spacing } from "../theme";

type UnsavedChangesModalProps = {
  visible: boolean;
  onYes: () => void;
  onNo: () => void;
  onDismiss?: () => void;
};

export function UnsavedChangesModal({
  visible,
  onYes,
  onNo,
  onDismiss,
}: UnsavedChangesModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss || onNo}
    >
      <Pressable style={s.backdrop} onPress={onDismiss || onNo}>
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
          <View style={s.iconWrap}>
            <Feather name="edit-3" size={22} color={colors.primary} />
          </View>
          <Text style={s.title}>Do you want to save these changes?</Text>
          <Text style={s.message}>
            You have unsaved changes on this form. Choose Yes to save before leaving, or No to discard them.
          </Text>
          <View style={s.actions}>
            <Pressable
              testID="unsaved-no-btn"
              style={s.noBtn}
              onPress={onNo}
              accessibilityRole="button"
              accessibilityLabel="No, discard changes"
            >
              <Text style={s.noTxt}>No</Text>
            </Pressable>
            <Pressable
              testID="unsaved-yes-btn"
              style={s.yesBtn}
              onPress={onYes}
              accessibilityRole="button"
              accessibilityLabel="Yes, save changes"
            >
              <Feather name="check" size={16} color="#fff" />
              <Text style={s.yesTxt}>Yes</Text>
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
    backgroundColor: colors.primarySofter,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
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
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  noTxt: { fontSize: 14, fontWeight: "700", color: colors.ink },
  yesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    ...Platform.select({
      web: { cursor: "pointer" } as object,
      default: {},
    }),
  },
  yesTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

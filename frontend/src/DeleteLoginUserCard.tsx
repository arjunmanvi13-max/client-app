import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, spacing } from "./theme";
import { FormSectionCard } from "./components/forms/FormSectionCard";

type Props = {
  displayTitle: string;
  onDelete: () => void;
};

export function DeleteLoginUserCard({ displayTitle, onDelete }: Props) {
  const noun = displayTitle.trim() || "user";
  return (
    <FormSectionCard title="Danger Zone" testID="login-user-delete-card">
      <Text style={s.help}>
        Permanently remove this {noun.toLowerCase()} account. They will no longer be able to sign in. This cannot be undone.
      </Text>
      <TouchableOpacity testID="btn-login-user-delete" style={s.deleteBtn} onPress={onDelete}>
        <Feather name="trash-2" size={16} color="#EF4444" />
        <Text style={s.deleteBtnTxt}>Delete {noun}</Text>
      </TouchableOpacity>
    </FormSectionCard>
  );
}

const s = StyleSheet.create({
  help: { fontSize: 12, color: colors.muted2, lineHeight: 18 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteBtnTxt: { fontSize: 13, fontWeight: "800", color: "#EF4444" },
});

import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../theme";

type FormPageHeaderProps = {
  breadcrumb: string;
  title: string;
  onCancel: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
  readOnly?: boolean;
  testID?: string;
};

export function FormPageHeader({
  breadcrumb,
  title,
  onCancel,
  onSave,
  saving,
  saveLabel = "Save Student",
  readOnly,
  testID = "form-page-header",
}: FormPageHeaderProps) {
  return (
    <View style={s.wrap} testID={testID}>
      <View style={s.left}>
        <Text style={s.breadcrumb}>{breadcrumb}</Text>
        <Text style={s.title}>{title}</Text>
      </View>
      <View style={s.actions}>
        <TouchableOpacity
          testID="form-cancel-btn"
          onPress={onCancel}
          style={s.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={s.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        {!readOnly && onSave && (
          <TouchableOpacity
            testID="form-save-btn"
            onPress={onSave}
            disabled={saving}
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="check" size={16} color="#fff" />
                <Text style={s.saveTxt}>{saveLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
    marginBottom: spacing.xl,
    flexWrap: "wrap",
  },
  left: { flex: 1, minWidth: 220 },
  breadcrumb: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted2,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 6,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({
      web: { cursor: "pointer", transition: "border-color 0.15s ease" } as object,
      default: {},
    }),
  },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: colors.ink },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    ...Platform.select({
      web: { cursor: "pointer", transition: "background-color 0.15s ease" } as object,
      default: {},
    }),
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

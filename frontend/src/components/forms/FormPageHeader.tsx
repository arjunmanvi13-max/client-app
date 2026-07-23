import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radii, spacing } from "../../theme";

type HeaderSecondaryAction = {
  label: string;
  onPress: () => void;
  testID?: string;
  icon?: keyof typeof Feather.glyphMap;
  tone?: "destructive" | "success" | "neutral";
  disabled?: boolean;
};

type FormPageHeaderProps = {
  breadcrumb: string;
  title: string;
  onCancel: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
  readOnly?: boolean;
  testID?: string;
  statusBadge?: { label: string; tone: "active" | "deactivated" };
  secondaryAction?: HeaderSecondaryAction;
  compact?: boolean;
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
  statusBadge,
  secondaryAction,
  compact,
}: FormPageHeaderProps) {
  return (
    <View style={[s.wrap, compact && s.wrapCompact]} testID={testID}>
      <View style={s.left}>
        <Text style={[s.breadcrumb, compact && s.breadcrumbCompact]}>{breadcrumb}</Text>
        <View style={[s.titleRow, compact && s.titleRowCompact]}>
          <Text style={[s.title, compact && s.titleCompact]}>{title}</Text>
          {statusBadge ? (
            <View
              style={[
                s.statusBadge,
                statusBadge.tone === "active" ? s.statusBadgeActive : s.statusBadgeDeactivated,
              ]}
              testID="form-status-badge"
            >
              <Feather
                name={statusBadge.tone === "active" ? "check-circle" : "slash"}
                size={12}
                color={statusBadge.tone === "active" ? "#16A34A" : colors.muted2}
              />
              <Text
                style={[
                  s.statusBadgeTxt,
                  { color: statusBadge.tone === "active" ? "#16A34A" : colors.muted2 },
                ]}
              >
                {statusBadge.label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={s.actions}>
        {secondaryAction ? (
          <TouchableOpacity
            testID={secondaryAction.testID}
            onPress={secondaryAction.onPress}
            disabled={secondaryAction.disabled}
            style={[
              s.secondaryBtn,
              compact && s.secondaryBtnCompact,
              secondaryAction.tone === "destructive" && s.secondaryBtnDestructive,
              secondaryAction.tone === "success" && s.secondaryBtnSuccess,
              secondaryAction.tone === "neutral" && s.secondaryBtnNeutral,
              secondaryAction.disabled && s.secondaryBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.label}
          >
            {secondaryAction.icon ? (
              <Feather
                name={secondaryAction.icon}
                size={15}
                color={
                  secondaryAction.tone === "destructive"
                    ? colors.danger
                    : secondaryAction.tone === "success"
                      ? "#16A34A"
                      : colors.ink
                }
              />
            ) : null}
            <Text
              style={[
                s.secondaryBtnTxt,
                secondaryAction.tone === "destructive" && s.secondaryBtnTxtDestructive,
                secondaryAction.tone === "success" && s.secondaryBtnTxtSuccess,
              ]}
            >
              {secondaryAction.label}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          testID="form-cancel-btn"
          onPress={onCancel}
          style={[s.cancelBtn, compact && s.cancelBtnCompact]}
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
            style={[s.saveBtn, compact && s.saveBtnCompact, saving && s.saveBtnDisabled]}
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
  wrapCompact: { marginBottom: 12, gap: spacing.sm, alignItems: "center" },
  left: { flex: 1, minWidth: 220 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: 6,
  },
  titleRowCompact: { marginTop: 2, gap: 8 },
  breadcrumb: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted2,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  breadcrumbCompact: { fontSize: 9, letterSpacing: 1 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  titleCompact: { fontSize: 22, lineHeight: 28 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  statusBadgeActive: { backgroundColor: "#DCFCE7" },
  statusBadgeDeactivated: { backgroundColor: colors.borderSoft },
  statusBadgeTxt: { fontSize: 12, fontWeight: "800" },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    ...Platform.select({
      web: { cursor: "pointer", transition: "border-color 0.15s ease, background-color 0.15s ease" } as object,
      default: {},
    }),
  },
  secondaryBtnCompact: { paddingHorizontal: 10, paddingVertical: 7 },
  secondaryBtnDestructive: {
    borderColor: "#FECACA",
    backgroundColor: colors.dangerSoft,
  },
  secondaryBtnSuccess: {
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
  },
  secondaryBtnNeutral: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnDisabled: { opacity: 0.55 },
  secondaryBtnTxt: { fontSize: 13, fontWeight: "700", color: colors.ink },
  secondaryBtnTxtDestructive: { color: colors.danger },
  secondaryBtnTxtSuccess: { color: "#16A34A" },
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
  cancelBtnCompact: { paddingHorizontal: 14, paddingVertical: 8 },
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
  saveBtnCompact: { paddingHorizontal: 14, paddingVertical: 8, gap: 6 },
  saveBtnDisabled: { opacity: 0.65 },
  saveTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

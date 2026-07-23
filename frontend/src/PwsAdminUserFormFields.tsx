import { View, Text, TouchableOpacity, Switch, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { UserRole } from "./rbac";
import { CategoryPermissionsPreview } from "./CategoryPermissionsPreview";
import {
  entityScopeLabel,
  PWS_ADMIN_DESIGNATIONS,
  pwsAdminDesignationLabel,
  type PwsAdminDesignation,
} from "./userClassification";
import { useBreakpoint } from "./useBreakpoint";
import { colors, formColors, radii, spacing } from "./theme";
import { FormTextField } from "./components/forms/FormTextField";

const PERM_GROUPS: { group: string; items: { key: string; label: string }[] }[] = [
  { group: "Data Access", items: [
    { key: "view_students", label: "View students" },
    { key: "view_players", label: "View players" },
    { key: "view_staff", label: "View staff" },
  ]},
  { group: "Attendance", items: [
    { key: "mark_student_attendance", label: "Mark student attendance" },
    { key: "mark_player_attendance", label: "Mark player attendance" },
    { key: "mark_staff_attendance", label: "Mark staff attendance" },
    { key: "mark_coach_attendance", label: "Mark coach attendance" },
  ]},
  { group: "Admin", items: [
    { key: "access_reports", label: "Access reports" },
    { key: "dashboard_access", label: "Dashboard access" },
    { key: "manage_users", label: "Manage users" },
    { key: "manage_academic_structure", label: "Manage academic structure" },
  ]},
  { group: "Fees & Bulk", items: [
    { key: "view_fees", label: "View fees" },
    { key: "collect_fees", label: "Collect fees" },
    { key: "edit_fees", label: "Edit fees" },
  ]},
];

type PwsAdminUserFormFieldsProps = {
  readOnly: boolean;
  isNew: boolean;
  isSuper: boolean;
  canManageUsersRosters: boolean;
  displayTitle: string;
  entityScope: string;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  department: string;
  setDepartment: (v: string) => void;
  designation: PwsAdminDesignation;
  setDesignation: (v: PwsAdminDesignation) => void;
  customizePerms: boolean;
  setCustomizePerms: (v: boolean) => void;
  toggleModulePerm: (key: string) => void;
  isModulePermChecked: (key: string) => boolean;
  userStatus?: "active" | "deactivated";
  onToggleUserStatus?: () => void;
  resetPwdVal?: string;
  setResetPwdVal?: (v: string) => void;
  onResetPassword?: () => void;
  resetBusy?: boolean;
};

function MetaChip({ label, value, tone = "neutral", testID }: { label: string; value: string; tone?: "neutral" | "scope"; testID?: string }) {
  return (
    <View style={[s.metaChip, tone === "scope" && s.metaChipScope]} testID={testID}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, tone === "scope" && s.metaValueScope]}>{value}</Text>
    </View>
  );
}

function DesignationGrid({
  value,
  onChange,
  readOnly,
}: {
  value: PwsAdminDesignation;
  onChange: (v: PwsAdminDesignation) => void;
  readOnly: boolean;
}) {
  const { isWide } = useBreakpoint();
  return (
    <View style={s.designationWrap}>
      <Text style={s.fieldLabel}>Designation</Text>
      <View style={[s.designationGrid, isWide && s.designationGridWide]}>
        {PWS_ADMIN_DESIGNATIONS.map((d) => {
          const active = value === d;
          return (
            <TouchableOpacity
              key={d}
              testID={`designation-${d}`}
              disabled={readOnly}
              onPress={() => onChange(d)}
              style={[
                s.designationBtn,
                isWide && s.designationBtnWide,
                active && s.designationBtnActive,
                readOnly && s.designationBtnReadonly,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[s.designationTxt, active && s.designationTxtActive]}>
                {pwsAdminDesignationLabel(d)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function PwsAdminUserFormFields({
  readOnly,
  isNew,
  isSuper,
  canManageUsersRosters,
  displayTitle,
  entityScope,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  phone,
  setPhone,
  department,
  setDepartment,
  designation,
  setDesignation,
  customizePerms,
  setCustomizePerms,
  toggleModulePerm,
  isModulePermChecked,
  userStatus,
  onToggleUserStatus,
  resetPwdVal = "",
  setResetPwdVal,
  onResetPassword,
  resetBusy,
}: PwsAdminUserFormFieldsProps) {
  const { isWide } = useBreakpoint();

  return (
    <View style={s.root} testID="pws-admin-user-form">
      <View style={s.card}>
        <View style={[s.gridRow, isWide && s.gridRowWide]}>
          <View style={s.col}>
            <FormTextField
              label="Name"
              required
              testID="field-name"
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              readOnly={readOnly}
            />
          </View>
          <View style={s.col}>
            <FormTextField
              label="Email (@prarambhika.com)"
              required
              testID="field-email"
              value={email}
              onChangeText={setEmail}
              editable={isNew || canManageUsersRosters}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@prarambhika.com"
              readOnly={!isNew && !canManageUsersRosters}
            />
          </View>
        </View>

        <View style={[s.gridRow, isWide && s.gridRowWide, s.gridRowGap]}>
          <View style={s.col}>
            <MetaChip label="User Type" value={displayTitle} testID="field-user-type" />
          </View>
          <View style={s.col}>
            <MetaChip
              label="Business Scope"
              value={entityScopeLabel(entityScope)}
              tone="scope"
              testID="field-entity-scope"
            />
          </View>
        </View>

        <View style={[s.gridRow, isWide && s.gridRowWide, s.gridRowGap]}>
          <View style={s.col}>
            <MetaChip label="User Category" value="PWS Admin" tone="scope" testID="field-user-category" />
          </View>
          <View style={s.col}>
            <FormTextField
              label="Phone"
              testID="field-phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+91 …"
              readOnly={readOnly}
            />
          </View>
        </View>

        <DesignationGrid value={designation} onChange={setDesignation} readOnly={readOnly} />

        <View style={[s.gridRow, isWide && s.gridRowWide, s.gridRowGap]}>
          <View style={s.col}>
            <FormTextField
              label="Department / Subject"
              testID="field-department"
              value={department}
              onChangeText={setDepartment}
              placeholder="e.g. Administration, Academics"
              readOnly={readOnly}
            />
          </View>
          <View style={s.col}>
            <FormTextField
              label={isNew ? "Assigned password" : "Assign new password (leave blank to keep)"}
              required={isNew}
              testID="field-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              readOnly={readOnly}
              hint="The user signs in with this password and will be prompted to set their own on first login."
            />
          </View>
        </View>
      </View>

      <CategoryPermissionsPreview userType={UserRole.PWS_ADMIN} displayName={displayTitle} />

      {isNew && isSuper && (
        <View style={s.permBox}>
          <View style={s.permHeadRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.permTitle}>Module Permissions</Text>
              <Text style={s.permHint}>
                {customizePerms ? "Tick the modules and actions this user may access." : "Role defaults will be applied. Toggle to customise."}
              </Text>
            </View>
            <Switch testID="perm-customize-switch" value={customizePerms} onValueChange={setCustomizePerms} />
          </View>
          {customizePerms && PERM_GROUPS.map((g) => (
            <View key={g.group} style={{ marginTop: 10 }}>
              <Text style={s.permGroupLabel}>{g.group.toUpperCase()}</Text>
              {g.items.map((it) => (
                <TouchableOpacity
                  key={it.key}
                  testID={`perm-${it.key}`}
                  style={s.permItemRow}
                  onPress={() => toggleModulePerm(it.key)}
                >
                  <Feather
                    name={isModulePermChecked(it.key) ? "check-square" : "square"}
                    size={18}
                    color={isModulePermChecked(it.key) ? formColors.primary : colors.hint}
                  />
                  <Text style={[s.permItemTxt, isModulePermChecked(it.key) && s.permItemTxtActive]}>{it.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      )}

      {!isNew && canManageUsersRosters && userStatus && onToggleUserStatus && (
        <View style={s.statusCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.statusLabel}>User Status</Text>
            <View style={[s.statusPill, userStatus === "active" ? s.statusPillActive : s.statusPillDeact]}>
              <Feather
                name={userStatus === "active" ? "check-circle" : "slash"}
                size={12}
                color={userStatus === "active" ? colors.success : colors.muted2}
              />
              <Text style={[s.statusPillTxt, { color: userStatus === "active" ? colors.success : colors.muted2 }]}>
                {userStatus === "active" ? "Active" : "Deactivated"}
              </Text>
            </View>
            <Text style={s.statusHelp}>
              {userStatus === "active"
                ? "Login disabled when deactivated."
                : "Account disabled. Tap Reactivate to restore login."}
            </Text>
          </View>
          <TouchableOpacity
            testID={userStatus === "active" ? "btn-user-deactivate" : "btn-user-activate"}
            style={[s.statusBtn, userStatus === "active" ? s.statusBtnDanger : s.statusBtnSuccess]}
            onPress={onToggleUserStatus}
          >
            <Feather
              name={userStatus === "active" ? "user-x" : "user-check"}
              size={16}
              color={userStatus === "active" ? colors.danger : colors.success}
            />
            <Text style={[s.statusBtnTxt, { color: userStatus === "active" ? colors.danger : colors.success }]}>
              {userStatus === "active" ? "Deactivate" : "Reactivate"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!isNew && canManageUsersRosters && onResetPassword && setResetPwdVal && (
        <View style={s.resetPwdBox}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="key" size={14} color="#B45309" />
            <Text style={s.resetPwdTitle}>Reset password (Super Admin)</Text>
          </View>
          <Text style={s.permHint}>Assign a temporary password. The user will be forced to set their own password on next login.</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <FormTextField
              label=""
              testID="reset-pwd-input"
              value={resetPwdVal}
              onChangeText={setResetPwdVal}
              placeholder="Temporary password (min 6)"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <TouchableOpacity
              testID="btn-reset-password"
              disabled={resetBusy || resetPwdVal.length < 6}
              style={[s.resetPwdGo, (resetBusy || resetPwdVal.length < 6) && { opacity: 0.5 }]}
              onPress={onResetPassword}
            >
              {resetBusy ? <ActivityIndicator color="#B45309" size="small" /> : <Text style={s.resetPwdGoTxt}>Set</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    ...Platform.select({
      web: { boxShadow: "0 1px 8px rgba(15, 23, 42, 0.05)" } as object,
      default: {},
    }),
  },
  gridRow: { gap: spacing.md },
  gridRowWide: { flexDirection: "row", alignItems: "flex-start" },
  gridRowGap: { marginTop: 0 },
  col: { flex: 1, minWidth: 0 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted2,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  metaChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 46,
    justifyContent: "center",
    gap: 2,
  },
  metaChipScope: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  metaLabel: { fontSize: 10, fontWeight: "700", color: colors.hint, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 14, fontWeight: "700", color: colors.ink },
  metaValueScope: { color: "#1E40AF" },
  designationWrap: { gap: 0 },
  designationGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  designationGridWide: { flexWrap: "nowrap" },
  designationBtn: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ web: { cursor: "pointer", transition: "border-color 0.15s ease, background-color 0.15s ease" } as object, default: {} }),
  },
  designationBtnWide: { flexBasis: 0, flex: 1 },
  designationBtnActive: { backgroundColor: formColors.primary, borderColor: formColors.primary },
  designationBtnReadonly: { opacity: 0.85 },
  designationTxt: { fontSize: 13, fontWeight: "700", color: colors.muted, textAlign: "center" },
  designationTxtActive: { color: "#fff" },
  permBox: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  permHeadRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  permTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  permHint: { fontSize: 11, color: colors.hint, marginTop: 2, lineHeight: 15 },
  permGroupLabel: { fontSize: 10, fontWeight: "800", color: colors.muted2, letterSpacing: 0.8, marginBottom: 4 },
  permItemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  permItemTxt: { fontSize: 13, color: colors.muted },
  permItemTxtActive: { color: colors.ink, fontWeight: "700" },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  statusLabel: { fontSize: 11, fontWeight: "700", color: colors.muted2, letterSpacing: 0.5, textTransform: "uppercase" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: "flex-start", marginTop: 6 },
  statusPillActive: { backgroundColor: colors.successSoft },
  statusPillDeact: { backgroundColor: colors.surface2 },
  statusPillTxt: { fontSize: 12, fontWeight: "800" },
  statusHelp: { fontSize: 11, color: colors.hint, marginTop: 4 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.sm },
  statusBtnDanger: { backgroundColor: colors.dangerSoft },
  statusBtnSuccess: { backgroundColor: colors.successSoft },
  statusBtnTxt: { fontSize: 13, fontWeight: "700" },
  resetPwdBox: { padding: spacing.md, backgroundColor: "#FEF3C7", borderRadius: radii.md, borderWidth: 1, borderColor: "#FCD34D" },
  resetPwdTitle: { color: "#92400E", fontSize: 13, fontWeight: "800" },
  resetPwdGo: { paddingHorizontal: 18, borderRadius: radii.sm, backgroundColor: "#FDE68A", alignItems: "center", justifyContent: "center", minHeight: 46, alignSelf: "flex-end" },
  resetPwdGoTxt: { color: "#92400E", fontSize: 12, fontWeight: "700" },
});

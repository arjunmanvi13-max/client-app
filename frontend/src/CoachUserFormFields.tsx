import { View, Text, TouchableOpacity, Switch, StyleSheet, Platform, ActivityIndicator, TextInput } from "react-native";
import type { Dispatch, SetStateAction } from "react";
import { Feather } from "@expo/vector-icons";
import { UserRole } from "./rbac";
import { CategoryPermissionsPreview } from "./CategoryPermissionsPreview";
import { entityScopeLabel, type LoginUserType } from "./userClassification";
import { useBreakpoint } from "./useBreakpoint";
import { colors, formColors, radii, spacing } from "./theme";
import { FormSectionCard } from "./components/forms/FormSectionCard";
import { FormTextField } from "./components/forms/FormTextField";
import { SegmentToggle } from "./components/forms/SegmentToggle";

const COACH_PERMS = [
  { key: "view_players", label: "View players" },
  { key: "add_players", label: "Add players" },
  { key: "edit_players", label: "Edit players" },
] as const;

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
  { group: "Assessments", items: [
    { key: "enter_coach_assessments", label: "Player Assessment" },
  ]},
  { group: "Management", items: [
    { key: "add_players", label: "Add players" },
    { key: "edit_players", label: "Edit players" },
    { key: "toggle_player_status", label: "Activate/deactivate players" },
    { key: "add_students", label: "Add students" },
    { key: "edit_students", label: "Edit students" },
  ]},
  { group: "Admin", items: [
    { key: "access_reports", label: "Access reports" },
    { key: "dashboard_access", label: "Dashboard access" },
    { key: "lifecycle_dashboard", label: "Lifecycle dashboard" },
    { key: "manage_users", label: "Manage users" },
    { key: "manage_academic_structure", label: "Manage academic structure" },
    { key: "enter_academic_marks", label: "Enter academic marks" },
    { key: "view_academic_marks", label: "View academic marks" },
  ]},
  { group: "Fees & Bulk", items: [
    { key: "view_fees", label: "View fees" },
    { key: "collect_fees", label: "Collect fees" },
    { key: "edit_fees", label: "Edit fees" },
    { key: "bulk_upload", label: "Bulk upload" },
    { key: "approve_deactivation", label: "Approve deactivation" },
  ]},
];

const CENTRES = ["Balua", "Harding Park"] as const;
const PLAYER_SPORTS = ["Cricket", "Football"] as const;
type PlayerSport = typeof PLAYER_SPORTS[number];

type CoachUserFormFieldsProps = {
  readOnly: boolean;
  isNew: boolean;
  isSuper: boolean;
  displayTitle: string;
  userTypeKind: LoginUserType | null;
  entityScope: string;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  assignedSports: string[];
  setAssignedSports: (v: string[]) => void;
  setAssignedSport: (v: string) => void;
  assignedCentres: string[];
  setAssignedCentres: Dispatch<SetStateAction<string[]>>;
  coachPermissions: string[];
  toggleCoachPerm: (key: string) => void;
  customizePerms: boolean;
  setCustomizePerms: (v: boolean) => void;
  permMap: Record<string, boolean>;
  setPermMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  userStatus?: "active" | "deactivated";
  onToggleUserStatus?: () => void;
  resetPwdVal?: string;
  setResetPwdVal?: (v: string) => void;
  onResetPassword?: () => void;
  resetBusy?: boolean;
};

function FormCheckbox({
  label,
  checked,
  onPress,
  testID,
  disabled,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[s.checkRow, checked && s.checkRowActive, disabled && s.checkRowDisabled]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[s.checkBox, checked && s.checkBoxActive]}>
        {checked && <Feather name="check" size={14} color="#fff" />}
      </View>
      <Text style={[s.checkLabel, checked && s.checkLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function CoachUserFormFields({
  readOnly,
  isNew,
  isSuper,
  displayTitle,
  userTypeKind,
  entityScope,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  phone,
  setPhone,
  assignedSports,
  setAssignedSports,
  setAssignedSport,
  assignedCentres,
  setAssignedCentres,
  coachPermissions,
  toggleCoachPerm,
  customizePerms,
  setCustomizePerms,
  permMap,
  setPermMap,
  userStatus,
  onToggleUserStatus,
  resetPwdVal = "",
  setResetPwdVal,
  onResetPassword,
  resetBusy,
}: CoachUserFormFieldsProps) {
  const { isWide } = useBreakpoint();
  const previewType = userTypeKind || UserRole.ALPHA_COACH;
  const sport: PlayerSport = (assignedSports[0] as PlayerSport) || "Cricket";

  const toggleCentre = (centre: string) => {
    if (readOnly) return;
    setAssignedCentres((prev) =>
      prev.includes(centre) ? prev.filter((c) => c !== centre) : [...prev, centre],
    );
  };

  const onSportChange = (next: PlayerSport) => {
    setAssignedSports([next]);
    setAssignedSport(next);
  };

  const toggleModulePerm = (key: string) => {
    setPermMap((prev) => {
      if (key === "enter_coach_assessments") {
        const next = !prev.enter_coach_assessments;
        return {
          ...prev,
          enter_coach_assessments: next,
          view_coach_assessments: next,
        };
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const isModulePermChecked = (key: string) => {
    if (key === "enter_coach_assessments") return !!permMap.enter_coach_assessments;
    return !!permMap[key];
  };

  return (
    <View style={s.root}>
      <View style={s.metaRow}>
        <View style={s.metaChip}>
          <Text style={s.metaChipLabel}>User Type</Text>
          <Text style={s.metaChipValue} testID="field-user-type">{displayTitle}</Text>
        </View>
        <View style={[s.metaChip, s.metaChipScope]}>
          <Text style={s.metaChipLabel}>Business Scope</Text>
          <Text style={[s.metaChipValue, s.metaChipScopeValue]} testID="field-entity-scope">
            {entityScopeLabel(entityScope)}
          </Text>
        </View>
      </View>

      <CategoryPermissionsPreview userType={previewType} displayName={displayTitle} />

      <View style={[s.grid, isWide && s.gridWide]}>
        <FormSectionCard title="Account Details" style={isWide ? s.col : { ...s.col, ...s.colFull }} testID="coach-account-card">
          <FormTextField
            label="Name"
            required
            testID="field-name"
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            readOnly={readOnly}
          />
          <FormTextField
            label="Email (@prarambhika.com)"
            required
            testID="field-email"
            value={email}
            onChangeText={setEmail}
            editable={isNew || isSuper}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@prarambhika.com"
            readOnly={!isNew && !isSuper}
          />
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
          <FormTextField
            label="Phone"
            testID="field-phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+91 …"
            readOnly={readOnly}
          />
        </FormSectionCard>

        <FormSectionCard
          title="Assignments & Permissions"
          style={isWide ? s.col : { ...s.col, ...s.colFull }}
          testID="coach-assignments-card"
        >
          <SegmentToggle
            label="Assigned Sport"
            value={sport}
            options={PLAYER_SPORTS}
            onChange={onSportChange}
            disabled={readOnly}
            testID="asport"
          />
          <Text style={s.fieldHelp}>
            A coach can be assigned to one sport only. This controls which players they can access after signing in.
          </Text>

          <View style={s.fieldBlock}>
            <Text style={s.fieldLabel}>Assigned Centres</Text>
            <Text style={s.fieldHelp}>Coach will see only players from these centres.</Text>
            <View style={s.checkList}>
              {CENTRES.map((centre) => (
                <FormCheckbox
                  key={centre}
                  testID={`acentre-${centre}`}
                  label={centre}
                  checked={assignedCentres.includes(centre)}
                  onPress={() => toggleCentre(centre)}
                  disabled={readOnly}
                />
              ))}
            </View>
          </View>

          {isNew && isSuper && (
            <View style={s.permPanel}>
              <View style={s.permPanelHead}>
                <View style={{ flex: 1 }}>
                  <Text style={s.permPanelTitle}>Module Permissions</Text>
                  <Text style={s.fieldHelp}>
                    {customizePerms
                      ? "Tick the modules and actions this user may access."
                      : "Role defaults will be applied. Toggle to customise."}
                  </Text>
                </View>
                <Switch testID="perm-customize-switch" value={customizePerms} onValueChange={setCustomizePerms} />
              </View>
              {customizePerms && (
                <View style={s.permGroups}>
                  {PERM_GROUPS.map((g) => (
                    <View key={g.group}>
                      <Text style={s.permGroupLabel}>{g.group.toUpperCase()}</Text>
                      {g.items.map((it) => (
                        <FormCheckbox
                          key={it.key}
                          testID={`perm-${it.key}`}
                          label={it.label}
                          checked={isModulePermChecked(it.key)}
                          onPress={() => toggleModulePerm(it.key)}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {isSuper && (
            <View style={s.fieldBlock}>
              <Text style={s.fieldLabel}>Coach editing rights</Text>
              <Text style={s.fieldHelp}>Choose what this coach can do with players.</Text>
              <View style={s.checkList}>
                {COACH_PERMS.map((p) => (
                  <FormCheckbox
                    key={p.key}
                    testID={`cperm-${p.key}`}
                    label={p.label}
                    checked={coachPermissions.includes(p.key)}
                    onPress={() => toggleCoachPerm(p.key)}
                    disabled={readOnly}
                  />
                ))}
              </View>
            </View>
          )}
        </FormSectionCard>
      </View>

      {!isNew && isSuper && userStatus && onToggleUserStatus && (
        <FormSectionCard title="Coach Status" testID="coach-status-card">
          <View style={s.statusRow}>
            <View style={{ flex: 1 }}>
              <View style={[s.statusPill, userStatus === "active" ? s.statusPillActive : s.statusPillDeact]}>
                <Feather
                  name={userStatus === "active" ? "check-circle" : "slash"}
                  size={12}
                  color={userStatus === "active" ? "#16A34A" : "#64748B"}
                />
                <Text style={[s.statusPillTxt, { color: userStatus === "active" ? "#16A34A" : "#64748B" }]}>
                  {userStatus === "active" ? "Active" : "Deactivated"}
                </Text>
              </View>
              <Text style={s.fieldHelp}>
                {userStatus === "active"
                  ? "Login disabled when deactivated. Excluded from coach attendance."
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
                color={userStatus === "active" ? "#EF4444" : "#16A34A"}
              />
              <Text style={[s.statusBtnTxt, { color: userStatus === "active" ? "#EF4444" : "#16A34A" }]}>
                {userStatus === "active" ? "Deactivate" : "Reactivate"}
              </Text>
            </TouchableOpacity>
          </View>
        </FormSectionCard>
      )}

      {!isNew && isSuper && setResetPwdVal && onResetPassword && (
        <FormSectionCard title="Reset Password" testID="coach-reset-pwd-card">
          <Text style={s.fieldHelp}>
            Assign a temporary password. The user will be forced to set their own password on next login.
          </Text>
          <View style={s.resetRow}>
            <TextInput
              testID="reset-pwd-input"
              value={resetPwdVal}
              onChangeText={setResetPwdVal}
              placeholder="Temporary password (min 6)"
              placeholderTextColor={colors.hint}
              style={s.resetInput}
              secureTextEntry
            />
            <TouchableOpacity
              testID="btn-reset-password"
              disabled={resetBusy || resetPwdVal.length < 6}
              style={[s.resetBtn, (resetBusy || resetPwdVal.length < 6) && { opacity: 0.5 }]}
              onPress={onResetPassword}
            >
              {resetBusy ? (
                <ActivityIndicator color="#B45309" size="small" />
              ) : (
                <Text style={s.resetBtnTxt}>Set</Text>
              )}
            </TouchableOpacity>
          </View>
        </FormSectionCard>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.lg, width: "100%", maxWidth: 1200, alignSelf: "center" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaChip: {
    flexGrow: 1,
    flexBasis: 180,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  metaChipScope: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  metaChipLabel: { fontSize: 10, fontWeight: "700", color: colors.muted2, letterSpacing: 0.6, textTransform: "uppercase" },
  metaChipValue: { fontSize: 14, fontWeight: "800", color: colors.ink },
  metaChipScopeValue: { color: formColors.primary },
  grid: { gap: spacing.lg },
  gridWide: { flexDirection: "row", alignItems: "flex-start" },
  col: { flex: 1, minWidth: 0, marginBottom: 0 },
  colFull: { width: "100%" },
  fieldBlock: { gap: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.2 },
  fieldHelp: { fontSize: 11, color: colors.hint, lineHeight: 15 },
  checkList: { gap: spacing.sm, marginTop: spacing.xs },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  checkRowActive: { borderColor: formColors.primary, backgroundColor: "#EFF6FF" },
  checkRowDisabled: { opacity: 0.7 },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxActive: { backgroundColor: formColors.primary, borderColor: formColors.primary },
  checkLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  checkLabelActive: { color: colors.ink },
  permPanel: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  permPanelHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  permPanelTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  permGroups: { gap: spacing.md, marginTop: spacing.xs },
  permGroupLabel: { fontSize: 10, fontWeight: "800", color: colors.muted2, letterSpacing: 0.8, marginBottom: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusPillActive: { backgroundColor: "#DCFCE7" },
  statusPillDeact: { backgroundColor: "#F1F5F9" },
  statusPillTxt: { fontSize: 12, fontWeight: "800" },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.md },
  statusBtnDanger: { backgroundColor: "#FEE2E2" },
  statusBtnSuccess: { backgroundColor: "#DCFCE7" },
  statusBtnTxt: { fontSize: 13, fontWeight: "700" },
  resetRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm },
  resetInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  resetBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  resetBtnTxt: { color: "#92400E", fontSize: 13, fontWeight: "700" },
});

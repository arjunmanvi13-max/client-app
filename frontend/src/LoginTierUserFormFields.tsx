import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FormTextField } from "./components/forms/FormTextField";
import { FormSelect } from "./components/forms/FormSelect";
import { colors, radii, spacing } from "./theme";
import {
  DESIGNATION_LABELS,
  designationsForEntity,
  type EntityScope,
  type StaffDesignation,
} from "./userClassification";
import type { ModuleAccessLevel } from "./designationAccess";
import { ACCESS_LEVELS, MODULE_MATRIX } from "./designationAccess";

type Props = {
  readOnly: boolean;
  isNew: boolean;
  displayTitle: string;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  entity: EntityScope;
  setEntity: (v: EntityScope) => void;
  designation: StaffDesignation;
  setDesignation: (v: StaffDesignation) => void;
  moduleAccess: Record<string, ModuleAccessLevel>;
  onOpenPermissions: () => void;
};

const ENTITY_OPTIONS = [
  { value: "PWS", label: "PWS" },
  { value: "ALPHA", label: "ALPHA" },
  { value: "BOTH", label: "Both" },
];

export function LoginTierUserFormFields({
  readOnly,
  isNew,
  displayTitle,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  phone,
  setPhone,
  entity,
  setEntity,
  designation,
  setDesignation,
  moduleAccess,
  onOpenPermissions,
}: Props) {
  const designationOptions = designationsForEntity(entity).map((code) => ({
    value: code,
    label: DESIGNATION_LABELS[code],
  }));
  const enabledCount = MODULE_MATRIX.filter((m) => (moduleAccess[m.id] || "none") !== "none").length;

  return (
    <View>
      <View style={s.metaRow}>
        <View style={s.metaChip} testID="field-user-type">
          <Text style={s.metaLabel}>Role</Text>
          <Text style={s.metaValue}>{displayTitle}</Text>
        </View>
      </View>

      <FormTextField label="Full name" required value={name} onChangeText={setName} editable={!readOnly} testID="field-name" />
      <FormTextField
        label="Email"
        required
        value={email}
        onChangeText={setEmail}
        editable={!readOnly}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="name@prarambhika.com"
        testID="field-email"
      />
      <FormTextField
        label={isNew ? "Assigned password" : "Assign new password (leave blank to keep)"}
        required={isNew}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        testID="field-password"
      />
      <FormTextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="field-phone" />

      <FormSelect
        label="Entity"
        required
        value={entity}
        options={ENTITY_OPTIONS}
        onChange={(v) => setEntity(v as EntityScope)}
        disabled={readOnly}
        testID="field-entity-scope"
      />
      <FormSelect
        label="Designation"
        required
        value={designation}
        options={designationOptions}
        onChange={(v) => setDesignation(v as StaffDesignation)}
        disabled={readOnly}
        testID="field-designation"
      />

      <TouchableOpacity style={s.permCta} onPress={onOpenPermissions} testID="open-perm-matrix" disabled={readOnly}>
        <Feather name="sliders" size={16} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.permTitle}>Module permissions</Text>
          <Text style={s.permHint}>
            {enabledCount} module{enabledCount === 1 ? "" : "s"} enabled · {ACCESS_LEVELS.find((l) => l.code === (moduleAccess.fees || "none"))?.label} on Fees
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  metaRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  metaChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  metaLabel: { fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase" },
  metaValue: { fontSize: 14, fontWeight: "800", color: colors.primary, marginTop: 2 },
  permCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    padding: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  permTitle: { fontSize: 14, fontWeight: "800", color: colors.ink2 },
  permHint: { fontSize: 12, color: colors.muted2, marginTop: 2 },
});

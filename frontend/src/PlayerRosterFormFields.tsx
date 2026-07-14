import type { Dispatch, SetStateAction } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "./auth";
import { DATE_PLACEHOLDER, dateHelpText, formatDate, parseToISO, toISODate } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radii } from "./theme";
import { FormSelect, type FormSelectOption } from "./components/forms/FormSelect";
import { FormSectionCard } from "./components/forms/FormSectionCard";
import { FormFieldGrid } from "./components/forms/FormFieldGrid";

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const SLOTS = ["Morning", "Evening", "Both"] as const;
const CENTRES = ["Balua", "Harding Park"] as const;
const PLAYER_SPORTS = ["Cricket", "Football"] as const;
const PLAYER_TYPES = ["Daily", "Hostel Only", "Day Boarding", "Boarding"] as const;
const ADHOC_FEE_TYPES = ["Uniform", "Kit", "Tournament", "Books", "Event", "Other"] as const;

export type PlayerType = typeof PLAYER_TYPES[number];

const CENTRE_TYPES: Record<string, PlayerType[]> = {
  Balua: ["Daily", "Hostel Only", "Day Boarding", "Boarding"],
  "Harding Park": ["Daily"],
};

const RATE_CARD: Record<PlayerType, Record<string, { registration: number; monthly: number }>> = {
  Daily: { Cricket: { registration: 3000, monthly: 2500 }, Football: { registration: 3000, monthly: 2000 } },
  "Hostel Only": { Cricket: { registration: 3000, monthly: 12000 }, Football: { registration: 3000, monthly: 15000 } },
  "Day Boarding": { Cricket: { registration: 3000, monthly: 7500 }, Football: { registration: 3000, monthly: 7500 } },
  Boarding: { Cricket: { registration: 20000, monthly: 15000 }, Football: { registration: 20000, monthly: 15000 } },
};

function requiresBothSlots(pt: PlayerType | ""): boolean {
  return pt === "Hostel Only" || pt === "Boarding";
}

function calcAge(dob: string): number | null {
  const iso = parseToISO(dob) || dob;
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [yy, mm, dd] = iso.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let yrs = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) yrs--;
  return Math.max(yrs, 0);
}

function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: onConfirm },
    ]);
  }
}

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {children}
      {required ? " *" : ""}
    </Text>
  );
}

export type PlayerRosterFormFieldsProps = {
  readOnly: boolean;
  isNew: boolean;
  isSuper: boolean;
  id: string;
  name: string;
  setName: (v: string) => void;
  playerId: string;
  setPlayerId: (v: string) => void;
  dob: string;
  setDob: (v: string) => void;
  mobile: string;
  setMobile: (v: string) => void;
  locality: string;
  setLocality: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  centre: "Balua" | "Harding Park" | "";
  setCentre: (v: "Balua" | "Harding Park" | "") => void;
  playerType: PlayerType | "";
  setPlayerType: (v: PlayerType | "") => void;
  sport: string;
  setSport: (v: string) => void;
  skillLevel: "Beginner" | "Intermediate" | "Advanced" | "";
  setSkillLevel: (v: "Beginner" | "Intermediate" | "Advanced" | "") => void;
  slot: "Morning" | "Evening" | "Both" | "";
  setSlot: (v: "Morning" | "Evening" | "Both" | "") => void;
  dateOfAdmission: string;
  setDateOfAdmission: (v: string) => void;
  guardianName: string;
  setGuardianName: (v: string) => void;
  setFatherName: (v: string) => void;
  guardianPhone: string;
  setGuardianPhone: (v: string) => void;
  transportFeeMonthly: string;
  setTransportFeeMonthly: (v: string) => void;
  registrationFeeOverride: string;
  setRegistrationFeeOverride: (v: string) => void;
  monthlyFeeOverride: string;
  setMonthlyFeeOverride: (v: string) => void;
  hostelFeeOverride: string;
  setHostelFeeOverride: (v: string) => void;
  adhocFees: { fee_type: string; amount: string; due_date: string }[];
  setAdhocFees: Dispatch<SetStateAction<{ fee_type: string; amount: string; due_date: string }[]>>;
  coachSportLocked: boolean;
  coachAssignedSport?: string;
  status: "active" | "deactivated";
  setStatus: (v: "active" | "deactivated") => void;
};

export function PlayerRosterFormFields(props: PlayerRosterFormFieldsProps) {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const {
    readOnly,
    isNew,
    isSuper,
    id,
    name,
    setName,
    playerId,
    setPlayerId,
    dob,
    setDob,
    mobile,
    setMobile,
    locality,
    setLocality,
    city,
    setCity,
    centre,
    setCentre,
    playerType,
    setPlayerType,
    sport,
    setSport,
    skillLevel,
    setSkillLevel,
    slot,
    setSlot,
    dateOfAdmission,
    setDateOfAdmission,
    guardianName,
    setGuardianName,
    setFatherName,
    guardianPhone,
    setGuardianPhone,
    transportFeeMonthly,
    setTransportFeeMonthly,
    registrationFeeOverride,
    setRegistrationFeeOverride,
    monthlyFeeOverride,
    setMonthlyFeeOverride,
    hostelFeeOverride,
    setHostelFeeOverride,
    adhocFees,
    setAdhocFees,
    coachSportLocked,
    coachAssignedSport,
    status,
    setStatus,
  } = props;

  const playerTypeOptions: FormSelectOption[] = (centre ? CENTRE_TYPES[centre] : [...PLAYER_TYPES]).map(
    (pt) => ({ value: pt, label: pt }),
  );
  const sportOptions: FormSelectOption[] = PLAYER_SPORTS.filter(
    (sp) => !coachSportLocked || sp === coachAssignedSport,
  ).map((sp) => ({ value: sp, label: sp }));
  const slotLockedBoth = !!(playerType && requiresBothSlots(playerType));
  const slotOptions: FormSelectOption[] = slotLockedBoth
    ? [{ value: "Both", label: "Both (Morning & Evening)" }]
    : SLOTS.filter((sl) => sl !== "Both").map((sl) => ({ value: sl, label: sl }));

  const rc = playerType && sport ? RATE_CARD[playerType as PlayerType]?.[sport] : null;
  const regEff = registrationFeeOverride ? parseInt(registrationFeeOverride, 10) : (rc?.registration ?? 0);
  const monEff = monthlyFeeOverride
    ? parseInt(monthlyFeeOverride, 10)
    : hostelFeeOverride && (playerType === "Hostel Only" || playerType === "Boarding")
      ? parseInt(hostelFeeOverride, 10)
      : (rc?.monthly ?? 0);

  const onCentreChange = (c: string) => {
    setCentre(c as "Balua" | "Harding Park");
    if (c === "Harding Park" && playerType !== "Daily") {
      setPlayerType("Daily");
      setSlot("");
    }
  };

  const onPlayerTypeChange = (pt: string) => {
    setPlayerType(pt as PlayerType);
    if (requiresBothSlots(pt as PlayerType)) setSlot("Both");
    else if (slot === "Both") setSlot("");
  };

  return (
    <>
      <FormSectionCard title="Personal Information">
        <FormFieldGrid columns={3} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel required>Player Name</FieldLabel>
            <TextInput
              testID="field-name"
              editable={!readOnly}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Player ID</FieldLabel>
            <TextInput
              testID="field-player-id"
              editable={!readOnly}
              value={playerId}
              onChangeText={setPlayerId}
              placeholder="e.g. APL-0001"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Date of Birth</FieldLabel>
            <TextInput
              testID="field-dob"
              editable={!readOnly}
              value={dob}
              onChangeText={setDob}
              placeholder={DATE_PLACEHOLDER}
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
            {dob && calcAge(dob) !== null && (
              <Text style={s.dobHelp}>
                {formatDate(dob)} · Age {calcAge(dob)} years
              </Text>
            )}
          </View>
        </FormFieldGrid>

        <FormFieldGrid columns={3} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel>Mobile Number</FieldLabel>
            <TextInput
              testID="field-mobile"
              editable={!readOnly}
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              placeholder="9876543210"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Locality</FieldLabel>
            <TextInput
              testID="field-locality"
              editable={!readOnly}
              value={locality}
              onChangeText={setLocality}
              placeholder="e.g. Boring Road"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>City</FieldLabel>
            <TextInput
              testID="field-city"
              editable={!readOnly}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Patna"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
        </FormFieldGrid>
      </FormSectionCard>

      <FormSectionCard title="Sports & Admission Details">
        <FormFieldGrid columns={3} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel required>Date of Admission</FieldLabel>
            <TextInput
              testID="field-doa"
              editable={!readOnly}
              value={dateOfAdmission}
              onChangeText={setDateOfAdmission}
              placeholder={DATE_PLACEHOLDER}
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
            <Text style={s.help}>{dateHelpText()}</Text>
          </View>
          <View style={s.field}>
            <FieldLabel>Organization</FieldLabel>
            <View style={s.orgLocked} testID="org-locked-alpha">
              <Text style={s.orgLockedText}>ALPHA Sports Academy</Text>
            </View>
          </View>
        </FormFieldGrid>

        <FormFieldGrid columns={4} isWide={isWide}>
          <FormSelect
            label="Centre"
            required
            testID="field-centre"
            value={centre}
            disabled={readOnly}
            options={CENTRES.map((c) => ({ value: c, label: c }))}
            placeholder="Select centre"
            onChange={onCentreChange}
          />
          <FormSelect
            label="Player Type"
            required
            testID="field-player-type"
            value={playerType}
            disabled={readOnly || !centre}
            options={playerTypeOptions}
            placeholder="Select type"
            onChange={onPlayerTypeChange}
          />
          <FormSelect
            label="Sport"
            required
            testID="field-sport"
            value={sport}
            disabled={readOnly || coachSportLocked}
            options={sportOptions}
            placeholder="Select sport"
            onChange={setSport}
          />
          <FormSelect
            label="Skill Level"
            required
            testID="field-skill"
            value={skillLevel}
            disabled={readOnly}
            options={SKILL_LEVELS.map((sk) => ({ value: sk, label: sk }))}
            placeholder="Select level"
            onChange={(v) => setSkillLevel(v as typeof skillLevel)}
          />
        </FormFieldGrid>

        {coachSportLocked && coachAssignedSport && (
          <Text style={s.help}>Assigned sport: {coachAssignedSport}</Text>
        )}
        {centre === "Harding Park" && (
          <Text style={s.help}>Harding Park allows Daily players only.</Text>
        )}
        {playerType && (
          <Text style={s.help}>
            {playerType === "Daily" && "Attends training only — no hostel or boarding."}
            {playerType === "Hostel Only" && "Resides in hostel · attends training · uses hostel facilities."}
            {playerType === "Day Boarding" && "Stays during the day with meals · returns home evening."}
            {playerType === "Boarding" && "Full residential · hostel + Morning & Evening training + full boarding."}
          </Text>
        )}

        <FormFieldGrid columns={2} isWide={isWide}>
          <FormSelect
            label="Slot"
            required
            testID="field-slot"
            value={slotLockedBoth ? "Both" : slot}
            disabled={readOnly || slotLockedBoth}
            options={slotOptions}
            placeholder="Select slot"
            onChange={(v) => setSlot(v as typeof slot)}
          />
        </FormFieldGrid>
        {slotLockedBoth && (
          <Text style={s.help}>{playerType} players attend Morning & Evening sessions.</Text>
        )}

        <View style={[s.feeGrid, isWide && s.feeGridWide]} testID="fees-config">
          <View style={[s.feesBox, isWide && s.feesBoxCol]}>
            <View style={s.feesBoxHeader}>
              <Feather name="credit-card" size={14} color={colors.primary} />
              <Text style={s.feesBoxTitle}>
                Fee structure ({playerType || "Select player type"})
              </Text>
            </View>
            {!playerType || !sport ? (
              <Text style={s.feesBoxSub}>Pick a Player Type and Sport to see the applicable fee heads.</Text>
            ) : (
              <>
                <View style={s.feesReadonlyBox}>
                  <View style={s.feesReadonlyRow}>
                    <Text style={s.feesReadonlyKey}>Registration (one-time)</Text>
                    <Text style={s.feesReadonlyVal}>₹{regEff.toLocaleString("en-IN")}</Text>
                  </View>
                  {playerType === "Daily" && (
                    <View style={s.feesReadonlyRow}>
                      <Text style={s.feesReadonlyKey}>Monthly Coaching</Text>
                      <Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text>
                    </View>
                  )}
                  {playerType === "Hostel Only" && (
                    <View style={s.feesReadonlyRow}>
                      <Text style={s.feesReadonlyKey}>Hostel (Monthly · includes coaching)</Text>
                      <Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text>
                    </View>
                  )}
                  {playerType === "Day Boarding" && (
                    <View style={s.feesReadonlyRow}>
                      <Text style={s.feesReadonlyKey}>Day Boarding (Monthly · includes coaching)</Text>
                      <Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text>
                    </View>
                  )}
                  {playerType === "Boarding" && (
                    <View style={s.feesReadonlyRow}>
                      <Text style={s.feesReadonlyKey}>Boarding (Monthly · hostel + coaching)</Text>
                      <Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text>
                    </View>
                  )}
                  {transportFeeMonthly && parseInt(transportFeeMonthly, 10) > 0 && (
                    <View style={s.feesReadonlyRow}>
                      <Text style={s.feesReadonlyKey}>Transport (Monthly)</Text>
                      <Text style={s.feesReadonlyVal}>
                        ₹{parseInt(transportFeeMonthly, 10).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  )}
                </View>
                {isNew && (
                  <Text style={s.feesBoxNote}>
                    These invoices will be auto-created after the player is saved. First-month rule: admission on/before 15th = full; from 16th onward = 50%.
                  </Text>
                )}
              </>
            )}
            {!isNew && !isSuper && playerType && sport && (
              <TouchableOpacity onPress={() => router.push("/fees")} style={s.feeLink} testID="goto-fees-module">
                <Feather name="external-link" size={12} color={colors.primary} />
                <Text style={s.feeLinkText}>Edit fees in Fees Module (Super Admin only)</Text>
              </TouchableOpacity>
            )}
          </View>

          {(isNew || isSuper) && (
            <View style={[s.feesBox, s.overrideBox, isWide && s.feesBoxCol]}>
              <View style={s.feesBoxHeader}>
                <Feather name="edit-3" size={14} color="#0F766E" />
                <Text style={[s.feesBoxTitle, { color: "#0F766E" }]}>Fee overrides & transport</Text>
              </View>
              {isSuper && rc && (
                <>
                  <View style={s.overrideField}>
                    <Text style={s.overrideHint}>Registration (default ₹{rc.registration.toLocaleString("en-IN")})</Text>
                    <TextInput
                      testID="field-reg-fee-override"
                      value={registrationFeeOverride}
                      onChangeText={setRegistrationFeeOverride}
                      keyboardType="numeric"
                      placeholder={`Default ₹${rc.registration}`}
                      placeholderTextColor={colors.hint}
                      style={s.input}
                    />
                  </View>
                  <View style={s.overrideField}>
                    <Text style={s.overrideHint}>Monthly (default ₹{rc.monthly.toLocaleString("en-IN")})</Text>
                    <TextInput
                      testID="field-monthly-fee-override"
                      value={monthlyFeeOverride}
                      onChangeText={setMonthlyFeeOverride}
                      keyboardType="numeric"
                      placeholder={`Default ₹${rc.monthly}`}
                      placeholderTextColor={colors.hint}
                      style={s.input}
                    />
                  </View>
                </>
              )}
              {(playerType === "Hostel Only" || playerType === "Boarding") && !isSuper && (
                <View style={s.overrideField}>
                  <Text style={s.overrideHint}>Hostel fee override (₹/month)</Text>
                  <TextInput
                    testID="field-hostel-fee"
                    value={hostelFeeOverride}
                    onChangeText={setHostelFeeOverride}
                    keyboardType="numeric"
                    placeholder="Leave blank for rate-card default"
                    placeholderTextColor={colors.hint}
                    style={s.input}
                  />
                </View>
              )}
              <View style={s.overrideField}>
                <Text style={s.overrideHint}>Transport fee (₹/month — optional)</Text>
                <TextInput
                  testID="field-transport-fee"
                  value={transportFeeMonthly}
                  onChangeText={setTransportFeeMonthly}
                  keyboardType="numeric"
                  placeholder="0 = no transport"
                  placeholderTextColor={colors.hint}
                  style={s.input}
                />
              </View>
              {parseInt(transportFeeMonthly || "0", 10) > 0 && (
                <Text style={s.feesBoxNote}>Transport fee recurs monthly with the sports fee due-date.</Text>
              )}
              {!isNew && isSuper && (
                <TouchableOpacity onPress={() => router.push("/fees")} style={s.feeLink} testID="goto-fees-module">
                  <Feather name="external-link" size={12} color={colors.primary} />
                  <Text style={s.feeLinkText}>Edit fees in Fees Module</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {isNew && isSuper && (
          <View style={s.adhocBox} testID="adhoc-fees-section">
            <View style={s.feesBoxHeader}>
              <Feather name="plus-circle" size={14} color="#0F766E" />
              <Text style={[s.feesBoxTitle, { color: "#0F766E" }]}>Optional fee heads (during admission)</Text>
            </View>
            <Text style={s.feesBoxSub}>
              Add one-off charges (Uniform, Kit, Tournament, Books, Event, Other). Created in the Fees Module after save.
            </Text>
            {adhocFees.map((f, idx) => (
              <View key={idx} style={s.adhocRow} testID={`adhoc-row-${idx}`}>
                <FormSelect
                  label="Fee type"
                  testID={`adhoc-${idx}-type`}
                  value={f.fee_type}
                  options={ADHOC_FEE_TYPES.map((t) => ({ value: t, label: t }))}
                  onChange={(v) => setAdhocFees((prev) => prev.map((x, i) => (i === idx ? { ...x, fee_type: v } : x)))}
                />
                <FormFieldGrid columns={2} isWide={isWide}>
                  <View style={s.field}>
                    <FieldLabel>Amount</FieldLabel>
                    <TextInput
                      testID={`adhoc-${idx}-amount`}
                      keyboardType="numeric"
                      placeholder="Amount ₹"
                      placeholderTextColor={colors.hint}
                      value={f.amount}
                      onChangeText={(v) =>
                        setAdhocFees((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: v.replace(/[^0-9]/g, "") } : x)))
                      }
                      style={s.input}
                    />
                  </View>
                  <View style={s.field}>
                    <FieldLabel>Due date</FieldLabel>
                    <TextInput
                      testID={`adhoc-${idx}-due`}
                      placeholder={`Due ${DATE_PLACEHOLDER}`}
                      placeholderTextColor={colors.hint}
                      value={f.due_date}
                      onChangeText={(v) => setAdhocFees((prev) => prev.map((x, i) => (i === idx ? { ...x, due_date: v } : x)))}
                      style={s.input}
                    />
                  </View>
                </FormFieldGrid>
                <TouchableOpacity
                  testID={`adhoc-${idx}-remove`}
                  onPress={() => setAdhocFees((prev) => prev.filter((_, i) => i !== idx))}
                  style={s.adhocRemoveBtn}
                >
                  <Feather name="trash-2" size={14} color={colors.danger} />
                  <Text style={s.adhocRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              testID="adhoc-add-row"
              onPress={() =>
                setAdhocFees((prev) => [
                  ...prev,
                  { fee_type: "Uniform", amount: "", due_date: dateOfAdmission || formatDate(toISODate()) },
                ])
              }
              style={s.adhocAddBtn}
            >
              <Feather name="plus" size={14} color="#0F766E" />
              <Text style={s.adhocAddBtnTxt}>Add fee head</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isNew && isSuper && (
          <View style={s.statusCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.statusLabel}>Player Status</Text>
              <View style={[s.statusPill, status === "active" ? s.statusPillActive : s.statusPillDeact]}>
                <Feather
                  name={status === "active" ? "check-circle" : "slash"}
                  size={12}
                  color={status === "active" ? "#16A34A" : colors.muted2}
                />
                <Text style={[s.statusPillTxt, { color: status === "active" ? "#16A34A" : colors.muted2 }]}>
                  {status === "active" ? "Active" : "Deactivated"}
                </Text>
              </View>
              <Text style={s.statusHelp}>
                {status === "active" ? "Direct deactivate (super admin)" : "Hidden from attendance"}
              </Text>
            </View>
            <TouchableOpacity
              testID={status === "active" ? "btn-deactivate" : "btn-activate"}
              style={[s.statusBtn, status === "active" ? s.statusBtnDeact : s.statusBtnAct]}
              onPress={() => {
                if (status === "active" && !isSuper) {
                  confirmAction("Request deactivation?", "A request will be sent to Super Admin for approval.", async () => {
                    try {
                      await api.post("/deactivation-requests", { player_id: id });
                      Alert.alert("Request submitted", "Super Admin will review the request.");
                    } catch (e: any) {
                      Alert.alert("Error", e?.response?.data?.detail || "Failed");
                    }
                  });
                  return;
                }
                const next = status === "active" ? "deactivated" : "active";
                const verb = next === "active" ? "Reactivate" : "Deactivate";
                confirmAction(
                  `${verb} player?`,
                  `${verb} this player. ${next === "deactivated" ? "They will be removed from attendance." : "They return to active lists."}`,
                  async () => {
                    try {
                      await api.post(`/people/${id}/${next === "active" ? "activate" : "deactivate"}`);
                      setStatus(next);
                    } catch (e: any) {
                      Alert.alert("Error", e?.response?.data?.detail || "Failed");
                    }
                  },
                );
              }}
            >
              <Feather
                name={status === "active" ? "user-x" : "user-check"}
                size={16}
                color={status === "active" ? colors.danger : "#16A34A"}
              />
              <Text style={[s.statusBtnTxt, { color: status === "active" ? colors.danger : "#16A34A" }]}>
                {status === "active" ? "Deactivate" : "Reactivate"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </FormSectionCard>

      <FormSectionCard title="Guardian Information">
        <FormFieldGrid columns={2} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel>Guardian Name</FieldLabel>
            <TextInput
              testID="field-father"
              editable={!readOnly}
              value={guardianName}
              onChangeText={(v) => {
                setGuardianName(v);
                setFatherName(v);
              }}
              placeholder="Guardian name"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Guardian Phone</FieldLabel>
            <TextInput
              testID="field-guardian-phone-player"
              editable={!readOnly}
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              keyboardType="phone-pad"
              placeholder="+91 …"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
        </FormFieldGrid>
      </FormSectionCard>
    </>
  );
}

const s = StyleSheet.create({
  field: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  inputReadonly: { backgroundColor: colors.surface2, color: colors.muted2 },
  help: { fontSize: 12, color: colors.muted2, marginTop: 4 },
  dobHelp: { fontSize: 12, color: "#0F766E", marginTop: 6, fontWeight: "600" },
  orgLocked: {
    alignSelf: "stretch",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: "#93C5FD",
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  orgLockedText: { color: colors.primary, fontWeight: "700", fontSize: 15 },
  feeGrid: { gap: 12 },
  feeGridWide: { flexDirection: "row", alignItems: "flex-start" },
  feesBox: {
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: radii.md,
    padding: 12,
  },
  feesBoxCol: { flex: 1, minWidth: 0 },
  overrideBox: { backgroundColor: "#F0FDFA", borderColor: "#A7F3D0" },
  feesBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feesBoxTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  feesBoxSub: { fontSize: 11, color: colors.muted, marginTop: 8 },
  feesReadonlyBox: { backgroundColor: colors.surface, padding: 10, borderRadius: radii.sm, marginTop: 8 },
  feesReadonlyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  feesReadonlyKey: { fontSize: 12, color: colors.muted2, fontWeight: "600" },
  feesReadonlyVal: { fontSize: 12, color: colors.ink, fontWeight: "800" },
  feesBoxNote: { fontSize: 11, color: colors.primary, marginTop: 8, fontStyle: "italic" },
  feeLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  feeLinkText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  overrideField: { marginTop: 10 },
  overrideHint: { fontSize: 12, color: colors.muted2, marginBottom: 6 },
  adhocBox: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: radii.md,
    padding: 12,
    gap: 10,
  },
  adhocRow: {
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    gap: 8,
  },
  adhocRemoveBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  adhocRemoveText: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  adhocAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#0F766E",
    backgroundColor: colors.surface,
  },
  adhocAddBtnTxt: { fontSize: 12, fontWeight: "800", color: "#0F766E" },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  statusLabel: { fontSize: 12, fontWeight: "700", color: colors.muted2, letterSpacing: 0.5 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  statusPillActive: { backgroundColor: "#DCFCE7" },
  statusPillDeact: { backgroundColor: colors.borderSoft },
  statusPillTxt: { fontSize: 12, fontWeight: "800" },
  statusHelp: { fontSize: 11, color: colors.hint, marginTop: 4 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.sm },
  statusBtnDeact: { backgroundColor: colors.dangerSoft },
  statusBtnAct: { backgroundColor: "#DCFCE7" },
  statusBtnTxt: { fontSize: 13, fontWeight: "700" },
});

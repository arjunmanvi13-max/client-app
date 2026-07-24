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
import { colors, radii, spacing } from "./theme";
import { FormSelect, type FormSelectOption } from "./components/forms/FormSelect";
import { FormSectionCard } from "./components/forms/FormSectionCard";
import { FormFieldGrid } from "./components/forms/FormFieldGrid";
import { FormTextField } from "./components/forms/FormTextField";
import { FormFileDropzone } from "./components/forms/FormFileDropzone";
import { PWS_CLASS_OPTIONS, SECTION_LETTERS } from "./StudentRosterFormFields";

const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const SLOTS = ["Morning", "Evening", "Both"] as const;
const CENTRES = ["Balua", "Harding Park"] as const;
const PLAYER_SPORTS = ["Cricket", "Football"] as const;
const PLAYER_TYPES = ["Daily", "Hostel Only", "Day Boarding", "Boarding"] as const;
const ADHOC_FEE_TYPES = ["Uniform", "Kit", "Tournament", "Books", "Event", "Other"] as const;

/** Flat monthly fee enforced for Boarding player type (PWS-linked attributes). */
export const BOARDING_FLAT_MONTHLY_FEE = 3000;

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
      {required ? <Text style={s.requiredMark}> *</Text> : null}
    </Text>
  );
}

function FeesEmptyState() {
  return (
    <View style={s.feesEmptyState} testID="fees-empty-state">
      <View style={s.feesEmptyIcon}>
        <Feather name="info" size={18} color={colors.primary} />
      </View>
      <Text style={s.feesEmptyTitle}>Select Player Type & Sport to load fee heads</Text>
      <Text style={s.feesEmptySub}>Fee structure will appear here once admission details are complete.</Text>
    </View>
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
  boardingClass: string;
  setBoardingClass: (v: string) => void;
  boardingSectionLetter: string;
  setBoardingSectionLetter: (v: string) => void;
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
    boardingClass,
    setBoardingClass,
    boardingSectionLetter,
    setBoardingSectionLetter,
  } = props;

  const isBoardingType = playerType === "Boarding";
  const boardingClassOptions: FormSelectOption[] = PWS_CLASS_OPTIONS.map((c) => ({ value: c, label: c }));
  const boardingSectionOptions: FormSelectOption[] = SECTION_LETTERS.map((l) => ({ value: l, label: l }));

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
  const regEff = registrationFeeOverride
    ? parseInt(registrationFeeOverride, 10)
    : (rc?.registration ?? 0);
  const alphaMonEff = monthlyFeeOverride
    ? parseInt(monthlyFeeOverride, 10)
    : hostelFeeOverride && playerType === "Hostel Only"
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
    if (pt !== "Boarding") {
      setBoardingClass("");
      setBoardingSectionLetter("");
    }
    if (requiresBothSlots(pt as PlayerType)) setSlot("Both");
    else if (slot === "Both") setSlot("");
  };

  return (
    <View style={s.formRoot}>
      <View style={[s.topGrid, isWide && s.topGridWide]}>
        <FormSectionCard title="Personal Information" compact style={s.sectionCard}>
          <View style={[s.personalLayout, isWide && s.personalLayoutWide]}>
            {!readOnly && (
              <View style={[s.photoCol, isWide && s.photoColWide]}>
                <FormFileDropzone label="Player photo" compact testID="field-player-photo" />
              </View>
            )}
            <View style={s.personalFields}>
              <FormFieldGrid columns={isWide ? 3 : 2} isWide={isWide}>
                <FormTextField
                  compact
                  label="Player Name"
                  required
                  testID="field-name"
                  editable={!readOnly}
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                />
                <View style={s.field}>
                  <FieldLabel>Player ID</FieldLabel>
                  {isNew ? (
                    <View style={[s.input, s.inputReadonly, s.autoIdBox]}>
                      <Text style={s.autoIdTxt} testID="field-player-id-auto">
                        Auto-assigned on save
                      </Text>
                    </View>
                  ) : (
                    <TextInput
                      testID="field-player-id"
                      editable={false}
                      value={playerId}
                      placeholder="—"
                      placeholderTextColor={colors.hint}
                      style={[s.input, s.inputReadonly, s.inputCompact]}
                    />
                  )}
                </View>
                <FormTextField
                  compact
                  label="Date of Birth"
                  testID="field-dob"
                  editable={!readOnly}
                  value={dob}
                  onChangeText={setDob}
                  placeholder={DATE_PLACEHOLDER}
                  hint={dob && calcAge(dob) !== null ? `${formatDate(dob)} · Age ${calcAge(dob)} years` : undefined}
                />
              </FormFieldGrid>
              <FormFieldGrid columns={isWide ? 3 : 2} isWide={isWide}>
                <FormTextField
                  compact
                  label="Mobile Number"
                  testID="field-mobile"
                  editable={!readOnly}
                  value={mobile}
                  onChangeText={setMobile}
                  keyboardType="phone-pad"
                  placeholder="9876543210"
                />
                <FormTextField
                  compact
                  label="Locality"
                  testID="field-locality"
                  editable={!readOnly}
                  value={locality}
                  onChangeText={setLocality}
                  placeholder="e.g. Boring Road"
                />
                <FormTextField
                  compact
                  label="City"
                  testID="field-city"
                  editable={!readOnly}
                  value={city}
                  onChangeText={setCity}
                  placeholder="e.g. Patna"
                />
              </FormFieldGrid>
            </View>
          </View>
        </FormSectionCard>

        <FormSectionCard title="Guardian & Emergency Contact" compact style={s.sectionCard}>
          <FormFieldGrid columns={2} isWide={isWide}>
            <FormTextField
              compact
              label="Guardian Name"
              testID="field-father"
              editable={!readOnly}
              value={guardianName}
              onChangeText={(v) => {
                setGuardianName(v);
                setFatherName(v);
              }}
              placeholder="Parent / guardian name"
            />
            <FormTextField
              compact
              label="Contact Number"
              testID="field-guardian-phone-player"
              editable={!readOnly}
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              keyboardType="phone-pad"
              placeholder="+91 …"
            />
          </FormFieldGrid>
        </FormSectionCard>
      </View>

      <FormSectionCard title="Academy Details" overline="ALPHA Sports Academy" compact>
        <FormFieldGrid columns={3} isWide={isWide}>
          <FormTextField
            compact
            label="Date of Admission"
            required
            testID="field-doa"
            editable={!readOnly}
            value={dateOfAdmission}
            onChangeText={setDateOfAdmission}
            placeholder={DATE_PLACEHOLDER}
            hint={dateHelpText()}
          />
          <FormSelect
            compact
            label="Location / Campus"
            required
            testID="field-centre"
            value={centre}
            disabled={readOnly}
            options={CENTRES.map((c) => ({ value: c, label: c }))}
            placeholder="Select centre"
            onChange={onCentreChange}
          />
          <FormSelect
            compact
            label="Player Type"
            required
            testID="field-player-type"
            value={playerType}
            disabled={readOnly || !centre}
            options={playerTypeOptions}
            placeholder="Select type"
            onChange={onPlayerTypeChange}
          />
        </FormFieldGrid>

        <FormFieldGrid columns={3} isWide={isWide}>
          <FormSelect
            compact
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
            compact
            label="Skill Level"
            required
            testID="field-skill"
            value={skillLevel}
            disabled={readOnly}
            options={SKILL_LEVELS.map((sk) => ({ value: sk, label: sk }))}
            placeholder="Select level"
            onChange={(v) => setSkillLevel(v as typeof skillLevel)}
          />
          <FormSelect
            compact
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

        {coachSportLocked && coachAssignedSport && (
          <Text style={s.help}>Assigned sport: {coachAssignedSport}</Text>
        )}
        {centre === "Harding Park" && (
          <Text style={s.help}>Harding Park allows Daily players only.</Text>
        )}
        {playerType && (
          <View style={s.typeHintBox}>
            <Feather name="info" size={14} color={colors.primary} />
            <Text style={s.typeHintText}>
              {playerType === "Daily" && "Attends training only — no hostel or boarding."}
              {playerType === "Hostel Only" && "Resides in hostel · attends training · uses hostel facilities."}
              {playerType === "Day Boarding" && "Stays during the day with meals · returns home evening."}
              {playerType === "Boarding" && "Full residential · PWS class & section required · ALPHA + PWS fees apply."}
            </Text>
          </View>
        )}
        {slotLockedBoth && (
          <Text style={s.help}>{playerType} players attend Morning & Evening sessions.</Text>
        )}

        {isBoardingType && (
          <View style={s.boardingFieldsBox} testID="boarding-class-section">
            <Text style={s.boardingFieldsLabel}>PWS class & section (required for Boarding)</Text>
            <FormFieldGrid columns={2} isWide={isWide}>
              <FormSelect
                label="Class"
                required
                testID="field-boarding-class"
                value={boardingClass}
                disabled={readOnly}
                options={boardingClassOptions}
                placeholder="Select class"
                onChange={setBoardingClass}
              />
              <FormSelect
                label="Section"
                required
                testID="field-boarding-section"
                value={boardingSectionLetter}
                disabled={readOnly || !boardingClass}
                options={boardingSectionOptions}
                placeholder="Select section"
                onChange={setBoardingSectionLetter}
              />
            </FormFieldGrid>
          </View>
        )}
      </FormSectionCard>

      <FormSectionCard title="Fees & Financials" testID="fees-config" compact>
        <View style={s.feesUnifiedCard}>
          <View style={s.feesUnifiedHeader}>
            <Feather name="credit-card" size={16} color={colors.primary} />
            <Text style={s.feesUnifiedTitle}>Fee breakdown & overrides</Text>
          </View>

          <View style={[s.feesUnifiedBody, isWide && (isNew || isSuper) && s.feesUnifiedBodyWide]}>
            <View style={[s.feesPanel, isWide && (isNew || isSuper) && s.feesPanelHalf]}>
              <Text style={s.feesPanelLabel}>Fee structure{playerType ? ` · ${playerType}` : ""}</Text>
              {!playerType || !sport ? (
                <FeesEmptyState />
              ) : (
                <>
                  <View style={s.feesReadonlyBox}>
                    <Text style={s.feesGroupLabel}>ALPHA Sports Academy</Text>
                    <View style={s.feesReadonlyRow}>
                      <Text style={s.feesReadonlyKey}>Registration (one-time)</Text>
                      <Text style={s.feesReadonlyVal}>₹{regEff.toLocaleString("en-IN")}</Text>
                    </View>
                    {playerType === "Daily" && (
                      <View style={s.feesReadonlyRow}>
                        <Text style={s.feesReadonlyKey}>Monthly Coaching</Text>
                        <Text style={s.feesReadonlyVal}>₹{alphaMonEff.toLocaleString("en-IN")}</Text>
                      </View>
                    )}
                    {playerType === "Hostel Only" && (
                      <View style={s.feesReadonlyRow}>
                        <Text style={s.feesReadonlyKey}>Hostel (Monthly · includes coaching)</Text>
                        <Text style={s.feesReadonlyVal}>₹{alphaMonEff.toLocaleString("en-IN")}</Text>
                      </View>
                    )}
                    {playerType === "Day Boarding" && (
                      <View style={s.feesReadonlyRow}>
                        <Text style={s.feesReadonlyKey}>Day Boarding (Monthly · includes coaching)</Text>
                        <Text style={s.feesReadonlyVal}>₹{alphaMonEff.toLocaleString("en-IN")}</Text>
                      </View>
                    )}
                    {playerType === "Boarding" && (
                      <View style={s.feesReadonlyRow}>
                        <Text style={s.feesReadonlyKey}>Boarding (Monthly · hostel + coaching)</Text>
                        <Text style={s.feesReadonlyVal}>₹{alphaMonEff.toLocaleString("en-IN")}</Text>
                      </View>
                    )}
                    {isBoardingType && (
                      <>
                        <View style={s.feesGroupDivider} />
                        <Text style={s.feesGroupLabel}>PWS (linked student profile)</Text>
                        <View style={[s.feesReadonlyRow, s.feesFixedRow]}>
                          <Text style={s.feesReadonlyKey}>PWS Tuition (Monthly)</Text>
                          <Text style={s.feesFixedVal}>₹{BOARDING_FLAT_MONTHLY_FEE.toLocaleString("en-IN")}</Text>
                        </View>
                      </>
                    )}
                    {transportFeeMonthly && parseInt(transportFeeMonthly, 10) > 0 && (
                      <View style={s.feesReadonlyRow}>
                        <Text style={s.feesReadonlyKey}>Transport (Monthly · ALPHA)</Text>
                        <Text style={s.feesReadonlyVal}>
                          ₹{parseInt(transportFeeMonthly, 10).toLocaleString("en-IN")}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isBoardingType && (
                    <Text style={s.feesBoxNote}>
                      Boarding players are billed default ALPHA sports fees plus a fixed ₹3,000/month PWS tuition linked to their class profile.
                    </Text>
                  )}
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
              <View style={[s.feesPanel, s.feesPanelOverrides, isWide && s.feesPanelHalf]}>
                <Text style={s.feesPanelLabel}>Overrides & transport</Text>
                {isBoardingType && (
                  <View style={s.overrideField}>
                    <Text style={s.overrideHint}>PWS tuition (fixed monthly · linked student profile)</Text>
                    <View style={[s.input, s.inputReadonly, s.fixedFeeInput]}>
                      <Text style={s.fixedFeeInputTxt}>₹{BOARDING_FLAT_MONTHLY_FEE.toLocaleString("en-IN")} / month</Text>
                    </View>
                  </View>
                )}
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
                      <Text style={s.overrideHint}>ALPHA monthly (default ₹{rc.monthly.toLocaleString("en-IN")})</Text>
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
                {playerType === "Hostel Only" && !isSuper && (
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
                  <TouchableOpacity onPress={() => router.push("/fees")} style={s.feeLink} testID="goto-fees-module-overrides">
                    <Feather name="external-link" size={12} color={colors.primary} />
                    <Text style={s.feeLinkText}>Edit fees in Fees Module</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
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
    </View>
  );
}

const s = StyleSheet.create({
  formRoot: { gap: spacing.md },
  topGrid: { gap: spacing.md },
  topGridWide: { flexDirection: "row", alignItems: "stretch", gap: spacing.md },
  sectionCard: { flex: 1, minWidth: 0 },
  personalLayout: { gap: spacing.sm },
  personalLayoutWide: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  photoCol: { width: "100%" },
  photoColWide: { width: 148, flexShrink: 0 },
  personalFields: { flex: 1, minWidth: 0, gap: spacing.sm },
  field: { flex: 1, minWidth: 0 },
  label: { fontSize: 11, fontWeight: "700", color: colors.muted, marginBottom: 4 },
  requiredMark: { color: colors.primary },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    minHeight: 46,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  inputCompact: { minHeight: 36, paddingVertical: 7, fontSize: 13, borderRadius: radii.sm },
  inputReadonly: { backgroundColor: colors.surface2, color: colors.muted2 },
  autoIdBox: { justifyContent: "center", minHeight: 36 },
  autoIdTxt: { fontSize: 12, color: colors.muted2, fontWeight: "600" },
  help: { fontSize: 11, color: colors.muted2, marginTop: 4, lineHeight: 16 },
  dobHelp: { fontSize: 11, color: "#0F766E", marginTop: 4, fontWeight: "600" },
  typeHintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typeHintText: { flex: 1, fontSize: 12, color: colors.primary, lineHeight: 18, fontWeight: "600" },
  boardingFieldsBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  boardingFieldsLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400E",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  feesUnifiedCard: {
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  feesUnifiedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#BFDBFE",
    backgroundColor: colors.surface,
  },
  feesUnifiedTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -0.1,
  },
  feesUnifiedBody: { padding: spacing.md, gap: spacing.md },
  feesUnifiedBodyWide: { flexDirection: "row", alignItems: "stretch" },
  feesPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    flex: 1,
    minHeight: 220,
  },
  feesPanelHalf: { flex: 1, minWidth: 0 },
  feesPanelOverrides: { borderColor: "#A7F3D0", backgroundColor: "#FAFFFE" },
  feesPanelLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted2,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  feesEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    minHeight: 160,
  },
  feesEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySofter,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  feesEmptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  feesEmptySub: {
    fontSize: 12,
    color: colors.muted2,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  feesBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feesBoxTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  feesBoxSub: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  feesReadonlyBox: { backgroundColor: colors.surface2, padding: 12, borderRadius: radii.sm, marginTop: 4 },
  feesGroupLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  feesGroupDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 10 },
  feesReadonlyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  feesReadonlyKey: { fontSize: 12, color: colors.muted2, fontWeight: "600", flex: 1, paddingRight: 8 },
  feesReadonlyVal: { fontSize: 12, color: colors.ink, fontWeight: "800" },
  feesFixedRow: { backgroundColor: "#ECFDF5", marginHorizontal: -4, paddingHorizontal: 4, borderRadius: radii.sm },
  feesFixedVal: { fontSize: 12, color: "#047857", fontWeight: "800" },
  fixedFeeInput: { justifyContent: "center" },
  fixedFeeInputTxt: { fontSize: 15, fontWeight: "700", color: "#047857" },
  feesBoxNote: { fontSize: 11, color: colors.primary, marginTop: 4, fontStyle: "italic", lineHeight: 16 },
  feeLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  feeLinkText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  overrideField: { marginTop: 4 },
  overrideHint: { fontSize: 12, color: colors.muted2, marginBottom: 6, fontWeight: "600" },
  adhocBox: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.md,
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
    marginTop: spacing.md,
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

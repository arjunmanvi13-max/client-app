import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, usePathname } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { BusinessEntity, Permission } from "../../../src/rbac";
import {
  PWS_CLASSES, PWS_STUDENT_TYPES, TRANSPORT_DISTANCES,
  resolveCategoryAmounts, canOverridePwsFees, type PwsStudentType, type TransportDistance,
} from "../../../src/pwsFeeStructure";
import { isCoachUser, resolveCoachDataScope } from "../../../src/coachAccess";
import { UserRole } from "../../../src/rbac";
import {
  CATALOG_BY_CODE,
  entityScopeLabel,
  filterUsersByType,
  isApprovedLoginUserType,
  legacyRoleForUserType,
  resolveRouteParam,
  type LoginUserType,
  type PwsAdminDesignation,
} from "../../../src/userClassification";
import { CategoryPermissionsPreview } from "../../../src/CategoryPermissionsPreview";
import { getManageListMeta, resolveManageKind } from "../../../src/manageKinds";
import {
  DATE_PLACEHOLDER,
  dateHelpText,
  formatDate,
  isValidDisplayDate,
  parseToISO,
  toISODate,
} from "../../../src/dateFormat";

const PERMS = ["student", "player", "teacher", "coach"] as const;
const COACH_PERMS = [
  { key: "view_players", label: "View players" },
  { key: "add_players", label: "Add players" },
  { key: "edit_players", label: "Edit players" },
] as const;
const ORGS = ["PWS", "ALPHA", "BOTH"] as const;

// Mirrors backend PERMISSION_GROUPS (core.py)
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
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const SLOTS = ["Morning", "Evening"] as const;
const CENTRES = ["Balua", "Harding Park"] as const;
const PLAYER_SPORTS = ["Cricket", "Football"] as const;
const PLAYER_TYPES = ["Daily", "Hostel Only", "Day Boarding", "Boarding"] as const;
type PlayerType = typeof PLAYER_TYPES[number];
const CENTRE_TYPES: Record<string, PlayerType[]> = {
  "Balua": ["Daily", "Hostel Only", "Day Boarding", "Boarding"],
  "Harding Park": ["Daily"],
};
// Slot rules — Hostel Only & Boarding attend BOTH sessions.
const requiresBothSlots = (pt: PlayerType | ""): boolean => pt === "Hostel Only" || pt === "Boarding";
// Rate card (mirror of backend fees.py RATE_CARDS)
const RATE_CARD: Record<PlayerType, Record<string, { registration: number; monthly: number }>> = {
  "Daily": { Cricket: { registration: 3000, monthly: 2500 }, Football: { registration: 3000, monthly: 2000 } },
  "Hostel Only": { Cricket: { registration: 3000, monthly: 12000 }, Football: { registration: 3000, monthly: 15000 } },
  "Day Boarding": { Cricket: { registration: 3000, monthly: 7500 }, Football: { registration: 3000, monthly: 7500 } },
  "Boarding": { Cricket: { registration: 20000, monthly: 15000 }, Football: { registration: 20000, monthly: 15000 } },
};
// Legacy PWS rate card — kept for players; students use pwsFeeStructure.ts (2026-27)
const PWS_RATE_CARD: Record<"Day Scholar" | "Hostel", { registration: number; monthly: number; exam: number; hostel_monthly?: number }> = {
  "Day Scholar": { registration: 5000, monthly: 8000, exam: 2500 },
  "Hostel": { registration: 5000, monthly: 8000, hostel_monthly: 12000, exam: 2500 },
};

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
// React Native Web's Alert.alert doesn't show buttons. Use window.confirm on web.
function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-undef
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: "destructive", onPress: onConfirm },
    ]);
  }
}

function showError(title: string, message: string) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-undef
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function ManageEdit() {
  const { kind: kindRaw, id: idRaw } = useLocalSearchParams<{ kind: string | string[]; id: string | string[] }>();
  const pathname = usePathname() || "";
  const kindParam = resolveManageKind(resolveRouteParam(kindRaw), pathname);
  const id = resolveRouteParam(idRaw);
  const { user } = useAuth();
  const router = useRouter();
  const isNew = id === "new";
  const userTypeKind = isApprovedLoginUserType(kindParam) ? (kindParam as LoginUserType) : null;
  const rosterMeta = getManageListMeta(kindParam);
  const isLoginUserKind = !!userTypeKind;
  const isLegacyUserKind = rosterMeta?.isUser === true;
  const isRosterPersonKind = rosterMeta?.isUser === false;
  const typeCatalog = userTypeKind ? CATALOG_BY_CODE[userTypeKind] : null;
  const isUserKind = isLoginUserKind || isLegacyUserKind;
  const isCoachKind = userTypeKind === UserRole.ALPHA_COACH || kindParam === "coach";
  const isPwsAdminKind = userTypeKind === UserRole.PWS_ADMIN;
  const isPlayerKind = kindParam === "player";
  const isStaffKind = kindParam === "staff";
  const isStudentKind = kindParam === "student";
  const displayTitle = typeCatalog?.displayName || rosterMeta?.label || kindParam || "User";

  useEffect(() => {
    if (kindRaw === undefined) return;
    if (!userTypeKind && !rosterMeta) router.replace("/manage");
  }, [kindRaw, userTypeKind, rosterMeta, router]);

  const isSuper = user?.role === "super_admin" || user?.user_type === "super_admin"
    || userHasPermission(user, Permission.MANAGE_ACCESS);
  const isAdmin = userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA)
    || userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_ACCESS);
  const isTeacher = user?.role === "teacher";
  const canOverrideFees = canOverridePwsFees(user?.role);
  const perms = user?.permissions || {};
  const canEdit = (() => {
    if (isLoginUserKind) return isSuper;
    if (!rosterMeta) return false;
    if (isNew) {
      if (isTeacher && isStudentKind) return false;
      if (isAdmin) return true;
      if (isStudentKind) return userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS);
      if (isPlayerKind) return userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA);
      if (isLegacyUserKind) return (user?.can_manage || []).includes(kindParam);
      return (user?.can_manage || []).includes(kindParam);
    }
    if (isTeacher && isStudentKind) return false;
    if (isAdmin) return true;
    if (isStudentKind) return userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS);
    if (isPlayerKind) {
      return userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA)
        || (user?.role === "coach" && (user?.coach_permissions || []).includes("edit_players"));
    }
    if (isLegacyUserKind) return isAdmin;
    return (user?.can_manage || []).includes(kindParam);
  })();
  const canDelete = canEdit && !isNew && (isAdmin || isStudentKind || isPlayerKind || isStaffKind || isLoginUserKind);
  const readOnly = !isNew && !canEdit;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Shared
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState<"PWS" | "ALPHA" | "BOTH">(
    (typeCatalog?.entityScope as "PWS" | "ALPHA" | "BOTH") || "PWS"
  );

  // User-only
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Super Admin: assign temp password (reset)
  const [resetPwdVal, setResetPwdVal] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  // Tick-box permissions at creation (admins)
  const [customizePerms, setCustomizePerms] = useState(false);
  const [permMap, setPermMap] = useState<Record<string, boolean>>({});
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [canManage, setCanManage] = useState<string[]>([]);
  const [coachPermissions, setCoachPermissions] = useState<string[]>([]);
  const [assignedSport, setAssignedSport] = useState("");

  // Person base
  const [group, setGroup] = useState("");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [academicSections, setAcademicSections] = useState<{ id: string; label: string }[]>([]);
  const [sport, setSport] = useState("");
  const [isResident, setIsResident] = useState(false);
  const [pwsStudentType, setPwsStudentType] = useState<PwsStudentType>("Day School");
  const [pwsClass, setPwsClass] = useState<string>("Class I");
  const [transportEnabled, setTransportEnabled] = useState(false);
  const [transportDistance, setTransportDistance] = useState<TransportDistance>("Up to 5 km");
  const [pwsOverrides, setPwsOverrides] = useState<Record<string, string>>({});

  // Player extras
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other" | "">("");
  const [personEmail, setPersonEmail] = useState("");
  const [address, setAddress] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [staffDepartment, setStaffDepartment] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [age, setAge] = useState("");
  const [skillLevel, setSkillLevel] = useState<"Beginner" | "Intermediate" | "Advanced" | "">("");
  const [mobile, setMobile] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [slot, setSlot] = useState<"Morning" | "Evening" | "Both" | "">("");
  const [assignedCoachId, setAssignedCoachId] = useState<string | null>(null);
  const [centre, setCentre] = useState<"Balua" | "Harding Park" | "">("");
  const [playerType, setPlayerType] = useState<PlayerType | "">("");
  const [dateOfAdmission, setDateOfAdmission] = useState<string>(isNew && isPlayerKind ? formatDate(toISODate()) : "");
  const [dob, setDob] = useState<string>("");
  const [transportFeeMonthly, setTransportFeeMonthly] = useState<string>("");
  const [hostelFeeOverride, setHostelFeeOverride] = useState<string>("");
  const [monthlyFeeOverride, setMonthlyFeeOverride] = useState<string>("");
  const [registrationFeeOverride, setRegistrationFeeOverride] = useState<string>("");
  const [status, setStatus] = useState<"active" | "deactivated">("active");

  // Optional ad-hoc fee heads to create during admission (Super Admin only)
  const [adhocFees, setAdhocFees] = useState<{ fee_type: string; amount: string; due_date: string }[]>([]);
  const ADHOC_FEE_TYPES = ["Uniform", "Kit", "Tournament", "Books", "Event", "Other"] as const;
  const coachScope = resolveCoachDataScope(user);
  const coachSportLocked = false;
  const coachCreatingPlayer = false;

  // Coach centre/sport assignment (admin -> coach)
  const [designation, setDesignation] = useState<PwsAdminDesignation>("PRINCIPAL");
  const [assignedCentres, setAssignedCentres] = useState<string[]>([]);
  const [assignedSports, setAssignedSports] = useState<string[]>([]);
  const [loadedUserType, setLoadedUserType] = useState<string | null>(null);
  const [loadedDesignation, setLoadedDesignation] = useState<PwsAdminDesignation | null>(null);

  // User-level status (coach/teacher activate-deactivate)
  const [userStatus, setUserStatus] = useState<"active" | "deactivated">("active");
  const [coachType, setCoachType] = useState<"head" | "assistant">("head");

  // Coaches list (for player assignment)
  const [coaches, setCoaches] = useState<any[]>([]);

  // Linked parents (student/player edit — admin only)
  const canLinkParents = !isNew && (isStudentKind || isPlayerKind) && isAdmin;
  const [parentUserIds, setParentUserIds] = useState<string[]>([]);
  const [parentUsers, setParentUsers] = useState<any[]>([]);
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [linkingParent, setLinkingParent] = useState(false);

  useEffect(() => {
    if (coachSportLocked && coachScope.assignedSport) {
      setSport(coachScope.assignedSport);
    }
    if (coachCreatingPlayer && coachScope.assignedCentres.length === 1) {
      setCentre(coachScope.assignedCentres[0] as any);
    }
  }, [coachSportLocked, coachCreatingPlayer, coachScope.assignedSport, coachScope.assignedCentres]);

  useEffect(() => {
    if (canLinkParents) {
      api.get("/users", { params: { role: "parent" } }).then((r) => setParentUsers(r.data || [])).catch(() => {});
    }
  }, [canLinkParents]);

  const linkParent = async (userId: string) => {
    setLinkingParent(true);
    try {
      const { data } = await api.post(`/people/${id}/link-parent`, { user_id: userId });
      setParentUserIds(data?.parent_user_ids || [...parentUserIds, userId]);
      setShowParentPicker(false);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to link parent");
    } finally { setLinkingParent(false); }
  };

  const unlinkParent = (userId: string, parentName: string) => {
    confirmAction("Unlink parent?", `Remove ${parentName} as a linked parent. They will lose visibility of this ${displayTitle}.`, async () => {
      try {
        const { data } = await api.delete(`/people/${id}/link-parent/${userId}`);
        setParentUserIds(data?.parent_user_ids || parentUserIds.filter((x) => x !== userId));
      } catch (e: any) {
        Alert.alert("Error", e?.response?.data?.detail || "Failed to unlink parent");
      }
    });
  };

  useEffect(() => {
    if (isPlayerKind) {
      api.get("/users/directory", { params: { role: "coach" } }).then((r) => setCoaches(r.data)).catch(() => {});
    }
  }, [isPlayerKind]);

  useEffect(() => {
    if (isNew) {
      // pre-fill assigned_coach_id when a coach creates
      if (isPlayerKind && user?.role === "coach") setAssignedCoachId(user.id);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        if (isUserKind) {
          let u: any = null;
          try {
            const params = userTypeKind ? { user_type: userTypeKind } : { role: kindParam };
            const { data: list } = await api.get("/users", { params });
            u = (Array.isArray(list) ? list : []).find((x: any) => x.id === id);
          } catch {
            /* fall through */
          }
          if (!u) {
            try {
              const { data } = await api.get(`/users/${id}`);
              u = data;
            } catch (e: any) {
              if (e?.response?.status === 405 || e?.response?.status === 404) {
                const { data: all } = await api.get("/users");
                u = (Array.isArray(all) ? all : []).find((x: any) => x.id === id);
              } else {
                throw e;
              }
            }
          }
          if (!u && userTypeKind) {
            const { data: all } = await api.get("/users");
            u = filterUsersByType(Array.isArray(all) ? all : [], userTypeKind).find((x: any) => x.id === id);
          }
          if (u) {
            setName(u.name); setEmail(u.email); setOrganization(u.organization);
            setDepartment(u.department || ""); setPhone(u.phone || "");
            setCanManage(u.can_manage || []);
            setCoachPermissions(u.coach_permissions || []);
            setAssignedSport(u.assigned_sport || "");
            setAssignedCentres(u.assigned_centres || []);
            setAssignedSports(u.assigned_sports?.length ? [u.assigned_sports[0]] : (u.assigned_sport ? [u.assigned_sport] : []));
            setUserStatus(u.status === "deactivated" ? "deactivated" : "active");
            setCoachType(u.coach_type === "assistant" ? "assistant" : "head");
            setLoadedUserType(u.user_type || kindParam || null);
            setLoadedDesignation(u.designation || null);
            if (u.designation) setDesignation(u.designation);
            if (u.organization) setOrganization(u.organization);
            else if (typeCatalog) setOrganization(typeCatalog.entityScope);
          }
        } else if (isRosterPersonKind) {
          const { data: p } = await api.get(`/people/${id}`);
          if (p) {
            setName(p.name); setOrganization(p.organization);
            setGroup(p.group || ""); setSport(p.sport || ""); setIsResident(!!p.is_resident);
            setPwsStudentType((p.pws_student_type as PwsStudentType) || (p.is_resident ? "Boarding" : "Day School"));
            setPwsClass(p.pws_class || "Class I");
            setTransportEnabled(!!p.transport_enabled || (p.transport_fee_monthly || 0) > 0);
            setTransportDistance((p.transport_distance as TransportDistance) || "Up to 5 km");
            const ov = p.pws_fee_overrides || {};
            setPwsOverrides(Object.fromEntries(Object.entries(ov).map(([k, v]) => [k, String(v)])));
            setSectionId(p.section_id || null);
            setAdmissionNumber(p.admission_number || "");
            setRollNumber(p.roll_number || "");
            setPlayerId(p.player_id || "");
            setEmployeeId(p.employee_id || "");
            setGender(p.gender || "");
            setPersonEmail(p.email || "");
            setAddress(p.address || "");
            setGuardianName(p.guardian_name || p.father_name || "");
            setGuardianPhone(p.guardian_phone || "");
            setStaffDepartment(p.department || "");
            setFatherName(p.father_name || p.guardian_name || "");
            setAge(p.age ? String(p.age) : "");
            setSkillLevel(p.skill_level || "");
            setMobile(p.mobile || "");
            setLocality(p.locality || "");
            setCity(p.city || "");
            setSlot(p.slot || "");
            setAssignedCoachId(p.assigned_coach_id || null);
            setCentre(p.centre || "");
            setPlayerType(p.player_type === "Hostel" ? "Hostel Only" : (p.player_type || ""));
            setDob(formatDate(p.dob || ""));
            setTransportFeeMonthly(p.transport_fee_monthly ? String(p.transport_fee_monthly) : "");
            setHostelFeeOverride(p.hostel_fee_override ? String(p.hostel_fee_override) : "");
            setMonthlyFeeOverride(p.monthly_fee_override ? String(p.monthly_fee_override) : "");
            setRegistrationFeeOverride(p.registration_fee_override ? String(p.registration_fee_override) : "");
            setDateOfAdmission(formatDate(p.date_of_admission || ""));
            setStatus(p.status === "deactivated" ? "deactivated" : "active");
            setParentUserIds(p.parent_user_ids || []);
          }
        }
      } catch (e: any) {
        Alert.alert("Error", e?.response?.data?.detail || "Failed to load user");
      } finally { setLoading(false); }
    })();
  }, [id, kindParam, isNew, isUserKind, isPlayerKind, isRosterPersonKind, user, userTypeKind, typeCatalog]);

  useEffect(() => {
    if (isStudentKind) {
      api.get("/academic/sections").then((r) => {
        setAcademicSections((r.data || []).map((sec: any) => ({ id: sec.id, label: sec.label })));
      }).catch(() => setAcademicSections([]));
    }
  }, [isStudentKind]);

  const togglePerm = (p: string) => setCanManage((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  const toggleCoachPerm = (p: string) => setCoachPermissions((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const confirmUserTypeChangeIfNeeded = (): Promise<boolean> => {
    if (isNew || !loadedUserType) return Promise.resolve(true);
    if (loadedUserType === userTypeKind && (!isPwsAdminKind || loadedDesignation === designation)) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      Alert.alert(
        "Change user type?",
        "Changing the user type will re-evaluate entity scope and module access. Confirm this change.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Confirm", style: "destructive", onPress: () => resolve(true) },
        ],
      );
    });
  };

  const confirmSportChangeIfNeeded = (): Promise<boolean> => {
    if (!isCoachKind || isNew || assignedSports.length !== 1) return Promise.resolve(true);
    const next = assignedSports[0];
    if (!assignedSport || assignedSport === next) return Promise.resolve(true);
    return new Promise((resolve) => {
      Alert.alert(
        "Change assigned sport?",
        "Changing the assigned sport will immediately change the player data this coach can access.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Change sport", style: "destructive", onPress: () => resolve(true) },
        ],
      );
    });
  };

  const save = async () => {
    if (!isLoginUserKind && !isRosterPersonKind && !isLegacyUserKind) {
      showError("Invalid record type", "This form is not for a supported manage route.");
      return;
    }
    if (!name.trim()) { showError("Name required", "Enter the full name."); return; }
    if ((isLoginUserKind || isLegacyUserKind) && isNew && (!email.trim() || !password.trim())) { showError("Required fields", "Email and password are required."); return; }
    if (isLoginUserKind && isCoachKind && assignedSports.length !== 1) {
      Alert.alert("Assigned sport required", "Select exactly one sport — Cricket or Football. A coach can only be assigned to one sport.");
      return;
    }
    if (isLoginUserKind && email.trim() && !email.trim().toLowerCase().endsWith("@prarambhika.com")) {
      Alert.alert("Invalid email", "Email must belong to the @prarambhika.com domain");
      return;
    }
    if (isPlayerKind && (!skillLevel || !slot || !centre || !playerType)) {
      Alert.alert("Centre, Player Type, Skill level and Slot are required for players");
      return;
    }
    if (isPlayerKind && centre === "Harding Park" && playerType !== "Daily") {
      Alert.alert("Harding Park allows Daily players only");
      return;
    }
    if (isPlayerKind && !dateOfAdmission) {
      Alert.alert("Date of Admission is required");
      return;
    }
    if (isCoachKind && isLoginUserKind && !(await confirmSportChangeIfNeeded())) return;
    if (isLoginUserKind && !(await confirmUserTypeChangeIfNeeded())) return;
    setSaving(true);
    try {
      if (isLoginUserKind && userTypeKind) {
        const scopeOrg = typeCatalog?.entityScope || organization;
        if (isNew) {
          const body: any = {
            email: email.trim().toLowerCase(),
            password,
            name,
            user_type: userTypeKind,
            role: legacyRoleForUserType(userTypeKind, isPwsAdminKind ? designation : null),
            organization: scopeOrg,
            department: department || null,
            phone: phone || null,
          };
          if (isPwsAdminKind) body.designation = designation;
          if (isSuper && customizePerms) body.permissions = permMap;
          if (isCoachKind) {
            body.coach_permissions = coachPermissions;
            body.coach_type = coachType;
            body.assigned_centres = assignedCentres;
            body.assigned_sport = assignedSports[0] || null;
            body.assigned_sports = assignedSports[0] ? [assignedSports[0]] : [];
          }
          await api.post("/users", body);
          router.replace(`/manage/${kindParam}`);
          return;
        } else {
          const body: any = { name, department: department || null, phone: phone || null };
          if (password) body.password = password;
          if (isSuper && email.trim()) body.email = email.trim().toLowerCase();
          if (isPwsAdminKind) body.designation = designation;
          if (isCoachKind) {
            body.coach_permissions = coachPermissions;
            body.coach_type = coachType;
            body.assigned_centres = assignedCentres;
            body.assigned_sport = assignedSports[0] || null;
            body.assigned_sports = assignedSports[0] ? [assignedSports[0]] : [];
          }
          await api.patch(`/users/${id}`, body);
          router.replace(`/manage/${kindParam}`);
          return;
        }
      } else if (isLegacyUserKind) {
        if (isNew) {
          const body: any = {
            email: email.trim().toLowerCase(),
            password,
            name,
            role: kindParam,
            organization,
            department: department || null,
            phone: phone || null,
          };
          if (isAdmin && customizePerms) body.permissions = permMap;
          if (isAdmin) {
            body.can_manage = canManage;
            if (kindParam === "coach") {
              body.coach_permissions = coachPermissions;
              body.coach_type = coachType;
              body.assigned_centres = assignedCentres;
              body.assigned_sport = assignedSports[0] || null;
              body.assigned_sports = assignedSports[0] ? [assignedSports[0]] : [];
            }
          }
          await api.post("/users", body);
        } else {
          const body: any = { name, organization, department: department || null, phone: phone || null };
          if (password) body.password = password;
          if (isAdmin && email.trim()) body.email = email.trim().toLowerCase();
          if (isAdmin) {
            body.can_manage = canManage;
            if (kindParam === "coach") {
              body.coach_permissions = coachPermissions;
              body.coach_type = coachType;
              body.assigned_centres = assignedCentres;
              body.assigned_sport = assignedSports[0] || null;
              body.assigned_sports = assignedSports[0] ? [assignedSports[0]] : [];
            }
          }
          await api.patch(`/users/${id}`, body);
        }
      } else if (isPlayerKind) {
        const isHostelType = playerType === "Hostel Only" || playerType === "Boarding";
        const body: any = {
          name, kind: "player", organization: "ALPHA",
          player_id: playerId || null,
          sport: sport || null, group: group || null, is_resident: isHostelType,
          guardian_name: guardianName || fatherName || null,
          father_name: guardianName || fatherName || null,
          guardian_phone: guardianPhone || null,
          age: dob ? calcAge(dob) : (age ? parseInt(age, 10) : null),
          dob: dob ? (parseToISO(dob) || dob) : null,
          skill_level: skillLevel || null,
          mobile: mobile || null,
          locality: locality || null,
          city: city || null,
          slot: slot || null,
          centre: centre || null,
          player_type: playerType || null,
          date_of_admission: dateOfAdmission ? (parseToISO(dateOfAdmission) || dateOfAdmission) : null,
          transport_fee_monthly: transportFeeMonthly ? parseInt(transportFeeMonthly, 10) : 0,
          hostel_fee_override: isHostelType && hostelFeeOverride ? parseInt(hostelFeeOverride, 10) : null,
        };
        // Super Admin only — override monthly / registration at admission
        if (isSuper) {
          body.monthly_fee_override = monthlyFeeOverride ? parseInt(monthlyFeeOverride, 10) : null;
          body.registration_fee_override = registrationFeeOverride ? parseInt(registrationFeeOverride, 10) : null;
        }
        // assigned_coach_id removed — players are centre-based
        if (isNew) {
          const created = await api.post("/people", body);
          // After creating the player, create any ad-hoc fee heads queued during admission
          const validAdhoc = adhocFees.filter((f) => f.fee_type && parseInt(f.amount || "0", 10) > 0 && isValidDisplayDate(f.due_date));
          if (validAdhoc.length > 0 && isSuper && created?.data?.id) {
            try {
              for (const f of validAdhoc) {
                await api.post("/fees", {
                  player_id: created.data.id,
                  fee_type: f.fee_type,
                  amount: parseInt(f.amount, 10),
                  due_date: parseToISO(f.due_date) || f.due_date,
                });
              }
            } catch (e: any) {
              Alert.alert("Some ad-hoc fees failed", e?.response?.data?.detail || "You can add them later from the Fees Module.");
            }
          }
        }
        else { delete body.kind; await api.patch(`/people/${id}`, body); }
      } else {
        const body: any = {
          name, kind, organization, group: group || null, sport: sport || null, is_resident: isResident,
          gender: gender || null,
          email: personEmail || null,
          mobile: mobile || null,
          address: address || null,
          guardian_name: guardianName || null,
          guardian_phone: guardianPhone || null,
        };
        if (isStudentKind) {
          body.admission_number = admissionNumber || null;
          body.roll_number = rollNumber || null;
          body.dob = dob ? (parseToISO(dob) || dob) : null;
        }
        if (isStudentKind && sectionId) body.section_id = sectionId;
        if (isStudentKind) {
          body.date_of_admission = parseToISO(dateOfAdmission) || dateOfAdmission || toISODate();
          body.pws_student_type = pwsStudentType;
          body.pws_class = pwsClass;
          body.transport_enabled = transportEnabled;
          body.transport_distance = transportEnabled ? transportDistance : null;
          body.is_resident = pwsStudentType === "Boarding";
          if (canOverrideFees) {
            const parsed: Record<string, number> = {};
            for (const [k, v] of Object.entries(pwsOverrides)) {
              const n = parseInt(v, 10);
              if (!Number.isNaN(n) && n >= 0) parsed[k] = n;
            }
            if (Object.keys(parsed).length) body.pws_fee_overrides = parsed;
          }
        }
        if (isStaffKind) {
          body.employee_id = employeeId || null;
          body.department = staffDepartment || group || null;
          body.centre = organization === "ALPHA" ? (centre || null) : null;
          body.is_resident = false;
        }
        if (isNew) await api.post("/people", body);
        else { delete body.kind; await api.patch(`/people/${id}`, body); }
      }
      router.back();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const message = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join("\n")
          : "Failed to save";
      showError("Error", message);
    } finally { setSaving(false); }
  };

  const onDelete = () => {
    if (isNew) return;
    confirmAction("Delete?", `This ${displayTitle} account will be permanently removed.`, async () => {
      try {
        if (isUserKind) await api.delete(`/users/${id}`);
        else await api.delete(`/people/${id}`);
        router.back();
      } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    });
  };

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="edit-back">
            <Feather name="x" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.h1}>{isNew ? `New ${displayTitle}` : readOnly ? `View ${displayTitle}` : `Edit ${displayTitle}`}</Text>
          {!isNew && canDelete && (
            <TouchableOpacity testID="delete-btn" onPress={onDelete} style={s.delBtn}>
              <Feather name="trash-2" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={s.label}>{isPlayerKind ? "Player Name *" : "Name *"}</Text>
          <TextInput testID="field-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#94A3B8" style={s.input} />

          {isLoginUserKind && (
            <>
              <Text style={s.label}>User Type</Text>
              <View style={[s.chip, { alignSelf: "flex-start", backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }]} testID="field-user-type">
                <Text style={[s.chipText, { color: "#0F172A" }]}>{displayTitle}</Text>
              </View>
              <Text style={s.label}>Business Scope</Text>
              <View style={[s.chip, { alignSelf: "flex-start", backgroundColor: "#DBEAFE", borderColor: "#93C5FD" }]} testID="field-entity-scope">
                <Text style={[s.chipText, { color: "#1E40AF" }]}>{entityScopeLabel(typeCatalog?.entityScope || organization)}</Text>
              </View>
              {isPwsAdminKind && (
                <>
                  <Text style={s.label}>Designation</Text>
                  <View style={s.chipRow}>
                    {(["PRINCIPAL", "VICE_PRINCIPAL"] as const).map((d) => (
                      <TouchableOpacity
                        key={d}
                        testID={`designation-${d}`}
                        style={[s.chip, { flex: 1 }, designation === d && s.chipActive, readOnly && { opacity: 0.85 }]}
                        disabled={readOnly}
                        onPress={() => setDesignation(d)}
                      >
                        <Text style={[s.chipText, designation === d && { color: "#fff" }]}>
                          {d === "PRINCIPAL" ? "Principal" : "Vice Principal"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              {userTypeKind && (
                <CategoryPermissionsPreview
                  userType={userTypeKind}
                  displayName={displayTitle}
                />
              )}
            </>
          )}

          {(isLoginUserKind || isLegacyUserKind) && (
            <>
              <Text style={s.label}>Email * (@prarambhika.com)</Text>
              <TextInput testID="field-email" value={email} onChangeText={setEmail} editable={isNew || isSuper} autoCapitalize="none" keyboardType="email-address" placeholder="name@prarambhika.com" placeholderTextColor="#94A3B8" style={[s.input, !isNew && !isSuper && { backgroundColor: "#F1F5F9", color: "#94A3B8" }]} />
              <Text style={s.label}>{isNew ? "Assigned password *" : "Assign new password (leave blank to keep)"}</Text>
              <TextInput testID="field-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" placeholderTextColor="#94A3B8" style={s.input} />
              <Text style={s.fieldHint}>The user signs in with this password and will be prompted to set their own on first login.</Text>
              {!isCoachKind && userTypeKind !== UserRole.SUPER_ADMIN && (
                <>
                  <Text style={s.label}>Department / Subject</Text>
                  <TextInput testID="field-department" value={department} onChangeText={setDepartment} placeholder="e.g. Mathematics, Cricket" placeholderTextColor="#94A3B8" style={s.input} />
                </>
              )}
              <Text style={s.label}>Phone</Text>
              <TextInput testID="field-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 …" placeholderTextColor="#94A3B8" style={s.input} />

              {isNew && isSuper && (
                <View style={s.permBox}>
                  <View style={s.permHeadRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.permTitle}>Module Permissions</Text>
                      <Text style={s.fieldHint}>{customizePerms ? "Tick the modules and actions this user may access." : "Role defaults will be applied. Toggle to customise."}</Text>
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
                          onPress={() => setPermMap((prev) => ({ ...prev, [it.key]: !prev[it.key] }))}
                        >
                          <Feather name={permMap[it.key] ? "check-square" : "square"} size={18} color={permMap[it.key] ? "#1E40AF" : "#94A3B8"} />
                          <Text style={[s.permItemTxt, permMap[it.key] && { color: "#0F172A", fontWeight: "700" }]}>{it.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {!isNew && isSuper && (
                <View style={s.statusCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.statusLabel}>{isCoachKind ? "Coach Status" : "User Status"}</Text>
                    <View style={[s.statusPill, userStatus === "active" ? s.statusPillActive : s.statusPillDeact]}>
                      <Feather name={userStatus === "active" ? "check-circle" : "slash"} size={12} color={userStatus === "active" ? "#16A34A" : "#64748B"} />
                      <Text style={[s.statusPillTxt, { color: userStatus === "active" ? "#16A34A" : "#64748B" }]}>
                        {userStatus === "active" ? "Active" : "Deactivated"}
                      </Text>
                    </View>
                    <Text style={s.statusHelp}>
                      {userStatus === "active"
                        ? "Login disabled when deactivated. Excluded from coach attendance."
                        : "Account disabled. Tap Reactivate to restore login."}
                    </Text>
                  </View>
                  <TouchableOpacity
                    testID={userStatus === "active" ? "btn-user-deactivate" : "btn-user-activate"}
                    style={[s.statusBtn, userStatus === "active" ? { backgroundColor: "#FEE2E2" } : { backgroundColor: "#DCFCE7" }]}
                    onPress={() => {
                      const next = userStatus === "active" ? "deactivated" : "active";
                      const verb = next === "active" ? "Reactivate" : "Deactivate";
                      confirmAction(`${verb} ${displayTitle}?`, `${verb} this account. ${next === "deactivated" ? "They will lose login access immediately." : "Login restored; user will appear in lists again."}`, async () => {
                        try {
                          await api.post(`/users/${id}/${next === "active" ? "activate" : "deactivate"}`);
                          setUserStatus(next);
                          Alert.alert("Done", `${kindParam === "coach" ? "Coach" : "User"} ${next === "active" ? "reactivated" : "deactivated"}.`);
                        } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
                      });
                    }}
                  >
                    <Feather name={userStatus === "active" ? "user-x" : "user-check"} size={16} color={userStatus === "active" ? "#EF4444" : "#16A34A"} />
                    <Text style={[s.statusBtnTxt, { color: userStatus === "active" ? "#EF4444" : "#16A34A" }]}>
                      {userStatus === "active" ? "Deactivate" : "Reactivate"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              {!isNew && isSuper && (
                <View style={s.resetPwdBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="key" size={14} color="#B45309" />
                    <Text style={s.resetPwdTitle}>Reset password (Super Admin)</Text>
                  </View>
                  <Text style={s.fieldHint}>Assign a temporary password. The user will be forced to set their own password on next login.</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TextInput
                      testID="reset-pwd-input"
                      value={resetPwdVal}
                      onChangeText={setResetPwdVal}
                      placeholder="Temporary password (min 6)"
                      placeholderTextColor="#94A3B8"
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                    />
                    <TouchableOpacity
                      testID="btn-reset-password"
                      disabled={resetBusy || resetPwdVal.length < 6}
                      style={[s.resetPwdGo, (resetBusy || resetPwdVal.length < 6) && { opacity: 0.5 }]}
                      onPress={async () => {
                        setResetBusy(true);
                        try {
                          await api.post(`/users/${id}/reset-password`, { new_password: resetPwdVal });
                          setResetPwdVal("");
                          Alert.alert("Done", "Temporary password set. Share it with the user — they must change it on next login.");
                          if (Platform.OS === "web") window.alert("Temporary password set. Share it with the user — they must change it on next login.");
                        } catch (e: any) {
                          const msg = e?.response?.data?.detail || "Failed";
                          if (Platform.OS === "web") window.alert(`Error: ${msg}`); else Alert.alert("Error", msg);
                        } finally { setResetBusy(false); }
                      }}
                    >
                      {resetBusy ? <ActivityIndicator color="#B45309" size="small" /> : <Text style={[s.resetPwdTxt, { flex: 0 }]}>Set</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}

          {isPlayerKind && (
            <>
              <Text style={s.label}>Player ID</Text>
              <TextInput testID="field-player-id" editable={!readOnly} value={playerId} onChangeText={setPlayerId} placeholder="e.g. APL-0001" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.label}>Centre *</Text>
              <View style={s.chipRow}>
                {CENTRES.map((c) => (
                  <TouchableOpacity key={c} testID={`centre-${c}`} style={[s.chip, { flex: 1 }, centre === c && s.chipActive]} onPress={() => {
                    setCentre(c);
                    if (c === "Harding Park" && playerType !== "Daily") { setPlayerType("Daily"); setSlot(""); }
                  }}>
                    <Feather name="map-pin" size={14} color={centre === c ? "#fff" : "#475569"} />
                    <Text style={[s.chipText, centre === c && { color: "#fff" }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Player Type *</Text>
              <View style={s.chipRow}>
                {(centre ? CENTRE_TYPES[centre] : PLAYER_TYPES).map((pt) => (
                  <TouchableOpacity key={pt} testID={`ptype-${pt}`} style={[s.chip, { flex: 1 }, playerType === pt && s.chipActive]} onPress={() => {
                    setPlayerType(pt as any);
                    // Auto-set slot to Both for Hostel Only / Boarding, clear for others
                    if (requiresBothSlots(pt as PlayerType)) setSlot("Both");
                    else if (slot === "Both") setSlot("");
                  }}>
                    <Text style={[s.chipText, playerType === pt && { color: "#fff" }]}>{pt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
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
              <Text style={s.label}>Sport *</Text>
              {coachSportLocked && (
                <Text style={s.help}>Assigned sport: {coachScope.assignedSport}</Text>
              )}
              <View style={s.chipRow}>
                {PLAYER_SPORTS.filter((sp) => !coachSportLocked || sp === coachScope.assignedSport).map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    testID={`sport-${sp}`}
                    disabled={coachSportLocked || readOnly}
                    style={[s.chip, { flex: 1 }, sport === sp && s.chipActive, (coachSportLocked || readOnly) && { opacity: 0.85 }]}
                    onPress={() => setSport(sp)}
                  >
                    <Feather name={sp === "Cricket" ? "target" : "circle"} size={14} color={sport === sp ? "#fff" : "#475569"} />
                    <Text style={[s.chipText, sport === sp && { color: "#fff" }]}>{sp}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Guardian Name</Text>
              <TextInput testID="field-father" editable={!readOnly} value={guardianName || fatherName} onChangeText={(v) => { setGuardianName(v); setFatherName(v); }} placeholder="Guardian name" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.label}>Guardian Phone</Text>
              <TextInput testID="field-guardian-phone-player" editable={!readOnly} value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" placeholder="+91 …" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.label}>Date of Birth</Text>
              <TextInput testID="field-dob" editable={!readOnly} value={dob} onChangeText={setDob} placeholder={DATE_PLACEHOLDER} placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              {dob && calcAge(dob) !== null && (
                <Text style={s.dobHelp}>
                  {formatDate(dob)} · Age {calcAge(dob)} years
                </Text>
              )}
              <Text style={s.label}>Skill Level *</Text>
              <View style={s.chipRow}>
                {SKILL_LEVELS.map((sk) => (
                  <TouchableOpacity key={sk} testID={`skill-${sk}`} style={[s.chip, skillLevel === sk && s.chipActive]} onPress={() => setSkillLevel(sk)}>
                    <Text style={[s.chipText, skillLevel === sk && { color: "#fff" }]}>{sk}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.label}>Slot *</Text>
              <View style={s.chipRow}>
                {(playerType && requiresBothSlots(playerType as PlayerType)) ? (
                  <View style={[s.chip, s.chipActive, { flex: 1 }]}>
                    <Feather name="sunrise" size={14} color="#fff" />
                    <Text style={[s.chipText, { color: "#fff" }]}>Both (Morning & Evening)</Text>
                  </View>
                ) : (
                  SLOTS.map((sl) => (
                    <TouchableOpacity key={sl} testID={`slot-${sl}`} style={[s.chip, { flex: 1 }, slot === sl && s.chipActive]} onPress={() => setSlot(sl)}>
                      <Feather name={sl === "Morning" ? "sun" : "moon"} size={14} color={slot === sl ? "#fff" : "#475569"} />
                      <Text style={[s.chipText, slot === sl && { color: "#fff" }]}>{sl}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
              {playerType && requiresBothSlots(playerType as PlayerType) && (
                <Text style={s.help}>{playerType} players attend Morning & Evening sessions.</Text>
              )}
              <Text style={s.label}>Mobile Number</Text>
              <TextInput testID="field-mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="9876543210" placeholderTextColor="#94A3B8" style={s.input} />

              <View style={s.feesBox} testID="fees-config">
                <View style={s.feesBoxHeader}>
                  <Feather name="credit-card" size={14} color="#1E40AF" />
                  <Text style={s.feesBoxTitle}>Fee structure ({playerType || "Select player type"})</Text>
                </View>
                {(() => {
                  const rc = (playerType && sport) ? RATE_CARD[playerType as PlayerType]?.[sport] : null;
                  const regEff = registrationFeeOverride ? parseInt(registrationFeeOverride, 10) : (rc?.registration ?? 0);
                  const monEff = monthlyFeeOverride ? parseInt(monthlyFeeOverride, 10) : (hostelFeeOverride && (playerType === "Hostel Only" || playerType === "Boarding") ? parseInt(hostelFeeOverride, 10) : (rc?.monthly ?? 0));
                  if (!playerType || !sport) {
                    return <Text style={s.feesBoxSub}>Pick a Player Type and Sport to see the applicable fee heads.</Text>;
                  }
                  return (
                    <>
                      <View style={s.feesReadonlyBox}>
                        <View style={s.feesReadonlyRow}><Text style={s.feesReadonlyKey}>Registration (one-time)</Text><Text style={s.feesReadonlyVal}>₹{regEff.toLocaleString("en-IN")}</Text></View>
                        {playerType === "Daily" && (
                          <View style={s.feesReadonlyRow}><Text style={s.feesReadonlyKey}>Monthly Coaching</Text><Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text></View>
                        )}
                        {playerType === "Hostel Only" && (
                          <View style={s.feesReadonlyRow}><Text style={s.feesReadonlyKey}>Hostel (Monthly · includes coaching)</Text><Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text></View>
                        )}
                        {playerType === "Day Boarding" && (
                          <View style={s.feesReadonlyRow}><Text style={s.feesReadonlyKey}>Day Boarding (Monthly · includes coaching)</Text><Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text></View>
                        )}
                        {playerType === "Boarding" && (
                          <View style={s.feesReadonlyRow}><Text style={s.feesReadonlyKey}>Boarding (Monthly · hostel + coaching)</Text><Text style={s.feesReadonlyVal}>₹{monEff.toLocaleString("en-IN")}</Text></View>
                        )}
                        {transportFeeMonthly && parseInt(transportFeeMonthly, 10) > 0 && (
                          <View style={s.feesReadonlyRow}><Text style={s.feesReadonlyKey}>Transport (Monthly)</Text><Text style={s.feesReadonlyVal}>₹{parseInt(transportFeeMonthly, 10).toLocaleString("en-IN")}</Text></View>
                        )}
                      </View>
                      {isNew && (
                        <Text style={s.feesBoxNote}>
                          These invoices will be auto-created after the player is saved. First-month rule: admission on/before 15th = full; from 16th onward = 50%.
                        </Text>
                      )}
                      {(isNew || isSuper) ? (
                        <>
                          {isSuper && (
                            <>
                              <Text style={s.label}>Registration Fee Override (Super Admin — optional)</Text>
                              <TextInput testID="field-reg-fee-override" value={registrationFeeOverride} onChangeText={setRegistrationFeeOverride} keyboardType="numeric" placeholder={`Default ₹${rc?.registration ?? 0}`} placeholderTextColor="#94A3B8" style={s.input} />
                              <Text style={s.label}>Monthly Fee Override (Super Admin — optional)</Text>
                              <TextInput testID="field-monthly-fee-override" value={monthlyFeeOverride} onChangeText={setMonthlyFeeOverride} keyboardType="numeric" placeholder={`Default ₹${rc?.monthly ?? 0}`} placeholderTextColor="#94A3B8" style={s.input} />
                            </>
                          )}
                          {(playerType === "Hostel Only" || playerType === "Boarding") && !isSuper && (
                            <>
                              <Text style={s.label}>Hostel Fee Override (₹/month — optional)</Text>
                              <TextInput testID="field-hostel-fee" value={hostelFeeOverride} onChangeText={setHostelFeeOverride} keyboardType="numeric" placeholder="Leave blank for rate-card default" placeholderTextColor="#94A3B8" style={s.input} />
                            </>
                          )}
                          <Text style={s.label}>Transport Fee (₹/month — optional)</Text>
                          <TextInput testID="field-transport-fee" value={transportFeeMonthly} onChangeText={setTransportFeeMonthly} keyboardType="numeric" placeholder="0 = no transport" placeholderTextColor="#94A3B8" style={s.input} />
                          {parseInt(transportFeeMonthly || "0", 10) > 0 && (
                            <Text style={s.feesBoxNote}>Transport fee recurs monthly with the same due-date as the sports fee.</Text>
                          )}
                        </>
                      ) : (
                        <TouchableOpacity onPress={() => router.push("/fees")} style={s.feesReadonlyLink} testID="goto-fees-module">
                          <Feather name="external-link" size={12} color="#1E40AF" />
                          <Text style={s.feesReadonlyLinkTxt}>Edit fees in Fees Module (Super Admin only)</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}
              </View>

              {isNew && isSuper && (
                <View style={s.adhocBox} testID="adhoc-fees-section">
                  <View style={s.feesBoxHeader}>
                    <Feather name="plus-circle" size={14} color="#0F766E" />
                    <Text style={[s.feesBoxTitle, { color: "#0F766E" }]}>Optional fee heads (during admission)</Text>
                  </View>
                  <Text style={s.feesBoxSub}>
                    Add one-off charges (Uniform, Kit, Tournament, Books, Event, Other). These will be created in the Fees Module after the player is saved.
                  </Text>
                  {adhocFees.map((f, idx) => (
                    <View key={idx} style={s.adhocRow} testID={`adhoc-row-${idx}`}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {ADHOC_FEE_TYPES.map((t) => (
                          <TouchableOpacity
                            key={t}
                            testID={`adhoc-${idx}-type-${t}`}
                            onPress={() => setAdhocFees((prev) => prev.map((x, i) => i === idx ? { ...x, fee_type: t } : x))}
                            style={[s.adhocChip, f.fee_type === t && s.adhocChipActive]}
                          >
                            <Text style={[s.adhocChipTxt, f.fee_type === t && { color: "#fff" }]}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                        <TextInput
                          testID={`adhoc-${idx}-amount`}
                          keyboardType="numeric"
                          placeholder="Amount ₹"
                          placeholderTextColor="#94A3B8"
                          value={f.amount}
                          onChangeText={(v) => setAdhocFees((prev) => prev.map((x, i) => i === idx ? { ...x, amount: v.replace(/[^0-9]/g, "") } : x))}
                          style={[s.input, { flex: 1, marginTop: 0 }]}
                        />
                        <TextInput
                          testID={`adhoc-${idx}-due`}
                          placeholder={`Due ${DATE_PLACEHOLDER}`}
                          placeholderTextColor="#94A3B8"
                          value={f.due_date}
                          onChangeText={(v) => setAdhocFees((prev) => prev.map((x, i) => i === idx ? { ...x, due_date: v } : x))}
                          style={[s.input, { flex: 1.2, marginTop: 0 }]}
                        />
                        <TouchableOpacity
                          testID={`adhoc-${idx}-remove`}
                          onPress={() => setAdhocFees((prev) => prev.filter((_, i) => i !== idx))}
                          style={s.adhocRemoveBtn}
                        >
                          <Feather name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity
                    testID="adhoc-add-row"
                    onPress={() => setAdhocFees((prev) => [...prev, { fee_type: "Uniform", amount: "", due_date: dateOfAdmission || formatDate(toISODate()) }])}
                    style={s.adhocAddBtn}
                  >
                    <Feather name="plus" size={14} color="#0F766E" />
                    <Text style={s.adhocAddBtnTxt}>Add fee head</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={s.label}>Locality</Text>
              <TextInput testID="field-locality" value={locality} onChangeText={setLocality} placeholder="e.g. Boring Road" placeholderTextColor="#94A3B8" style={s.input} />
              <Text style={s.label}>City</Text>
              <TextInput testID="field-city" value={city} onChangeText={setCity} placeholder="e.g. Patna" placeholderTextColor="#94A3B8" style={s.input} />

              <Text style={s.label}>Date of Admission *</Text>
              <TextInput
                testID="field-doa"
                value={dateOfAdmission}
                onChangeText={setDateOfAdmission}
                placeholder={DATE_PLACEHOLDER}
                placeholderTextColor="#94A3B8"
                style={s.input}
              />
              <Text style={s.help}>{dateHelpText()}</Text>

              {!isNew && isSuper && (
                <View style={s.statusCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.statusLabel}>Player Status</Text>
                    <View style={[s.statusPill, status === "active" ? s.statusPillActive : s.statusPillDeact]}>
                      <Feather name={status === "active" ? "check-circle" : "slash"} size={12} color={status === "active" ? "#16A34A" : "#64748B"} />
                      <Text style={[s.statusPillTxt, { color: status === "active" ? "#16A34A" : "#64748B" }]}>
                        {status === "active" ? "Active" : "Deactivated"}
                      </Text>
                    </View>
                    <Text style={s.statusHelp}>
                      {status === "active"
                        ? (isSuper ? "Direct deactivate (super admin)" : "Submits a request for super-admin approval")
                        : "Hidden from attendance"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    testID={status === "active" ? "btn-deactivate" : "btn-activate"}
                    style={[s.statusBtn, status === "active" ? { backgroundColor: "#FEE2E2" } : { backgroundColor: "#DCFCE7" }]}
                    onPress={async () => {
                      const isSuperAdmin = isSuper;
                      if (status === "active" && !isSuperAdmin) {
                        // Submit deactivation-request (no reason prompt on web for simplicity)
                        confirmAction("Request deactivation?", "A request will be sent to Super Admin for approval.", async () => {
                          try {
                            await api.post("/deactivation-requests", { player_id: id });
                            Alert.alert("Request submitted", "Super Admin will review the request.");
                          } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
                        });
                        return;
                      }
                      const next = status === "active" ? "deactivated" : "active";
                      const verb = next === "active" ? "Reactivate" : "Deactivate";
                      confirmAction(`${verb} player?`, `${verb} this player. ${next === "deactivated" ? "They will be removed from attendance." : "They return to active lists."}`, async () => {
                        try {
                          await api.post(`/people/${id}/${next === "active" ? "activate" : "deactivate"}`);
                          setStatus(next);
                        } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
                      });
                    }}
                  >
                    <Feather name={status === "active" ? "user-x" : "user-check"} size={16} color={status === "active" ? "#EF4444" : "#16A34A"} />
                    <Text style={[s.statusBtnTxt, { color: status === "active" ? "#EF4444" : "#16A34A" }]}>
                      {status === "active"
                        ? (isSuper ? "Deactivate" : "Request Deactivation")
                        : "Reactivate"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {!isUserKind && !isPlayerKind && !isStaffKind && (
            <>
              {isStudentKind && (
                <>
                  <Text style={s.label}>Admission Number</Text>
                  <TextInput testID="field-admission-number" editable={!readOnly} value={admissionNumber} onChangeText={setAdmissionNumber} placeholder="e.g. PWS-20250001" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                  <Text style={s.label}>Roll Number</Text>
                  <TextInput testID="field-roll-number" editable={!readOnly} value={rollNumber} onChangeText={setRollNumber} placeholder="e.g. 101" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                  <Text style={s.label}>Gender</Text>
                  <View style={s.chipRow}>
                    {(["Male", "Female", "Other"] as const).map((g) => (
                      <TouchableOpacity key={g} disabled={readOnly} style={[s.chip, gender === g && s.chipActive]} onPress={() => setGender(g)}>
                        <Text style={[s.chipText, gender === g && { color: "#fff" }]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.label}>Date of Birth</Text>
                  <TextInput testID="field-student-dob" editable={!readOnly} value={dob} onChangeText={setDob} placeholder={DATE_PLACEHOLDER} placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                  <Text style={s.label}>Phone</Text>
                  <TextInput testID="field-student-phone" editable={!readOnly} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="Student phone" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                  <Text style={s.label}>Email</Text>
                  <TextInput testID="field-student-email" editable={!readOnly} value={personEmail} onChangeText={setPersonEmail} autoCapitalize="none" keyboardType="email-address" placeholder="student@email.com" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                  <Text style={s.label}>Address</Text>
                  <TextInput testID="field-address" editable={!readOnly} value={address} onChangeText={setAddress} placeholder="Full address" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                  <Text style={s.label}>Guardian Name</Text>
                  <TextInput testID="field-guardian-name" editable={!readOnly} value={guardianName} onChangeText={setGuardianName} placeholder="Parent / guardian" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                  <Text style={s.label}>Guardian Phone</Text>
                  <TextInput testID="field-guardian-phone" editable={!readOnly} value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" placeholder="+91 …" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
                </>
              )}
              <Text style={s.label}>{isStudentKind ? "Grade / Section" : "Group"}</Text>
              {isStudentKind && academicSections.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                  {academicSections.map((sec) => (
                    <TouchableOpacity
                      key={sec.id}
                      testID={`field-section-${sec.label}`}
                      style={[s.miniChip, sectionId === sec.id && s.miniChipActive]}
                      onPress={() => { setSectionId(sec.id); setGroup(sec.label); }}
                    >
                      <Text style={[s.miniChipTxt, sectionId === sec.id && s.miniChipTxtActive]}>{sec.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <TextInput testID="field-group" value={group} onChangeText={setGroup} placeholder={isStudentKind ? "e.g. 9-A" : "Group"} placeholderTextColor="#94A3B8" style={s.input} />
              )}
              {isStudentKind && (
                <>
                  <Text style={s.label}>Student type *</Text>
                  <View style={s.chipRow}>
                    {PWS_STUDENT_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        testID={`field-pws-type-${t.replace(/\s+/g, "-")}`}
                        disabled={readOnly}
                        style={[s.chip, pwsStudentType === t && s.chipActive]}
                        onPress={() => {
                          setPwsStudentType(t);
                          setIsResident(t === "Boarding");
                        }}
                      >
                        <Text style={[s.chipText, pwsStudentType === t && { color: "#fff" }]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={s.label}>Class *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    {PWS_CLASSES.map((c) => (
                      <TouchableOpacity
                        key={c}
                        testID={`field-pws-class-${c.replace(/\s+/g, "-")}`}
                        disabled={readOnly}
                        style={[s.miniChip, pwsClass === c && s.miniChipActive]}
                        onPress={() => setPwsClass(c)}
                      >
                        <Text style={[s.miniChipTxt, pwsClass === c && s.miniChipTxtActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.switchLabel}>Transportation</Text>
                      <Text style={s.switchHelp}>Include monthly transport fee</Text>
                    </View>
                    <Switch
                      testID="field-transport-enabled"
                      value={transportEnabled}
                      onValueChange={setTransportEnabled}
                      disabled={readOnly}
                      trackColor={{ true: "#1E40AF" }}
                    />
                  </View>
                  {transportEnabled && (
                    <>
                      <Text style={s.label}>Distance</Text>
                      <View style={s.chipRow}>
                        {TRANSPORT_DISTANCES.map((d) => (
                          <TouchableOpacity
                            key={d}
                            disabled={readOnly}
                            style={[s.chip, transportDistance === d && s.chipActive]}
                            onPress={() => setTransportDistance(d)}
                          >
                            <Text style={[s.chipText, transportDistance === d && { color: "#fff" }]}>{d}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  <Text style={s.label}>Date of Admission *</Text>
                  <TextInput testID="field-admission-date" value={dateOfAdmission} onChangeText={setDateOfAdmission} placeholder={DATE_PLACEHOLDER} placeholderTextColor="#94A3B8" style={s.input} />
                  <View style={s.feesBox} testID="fees-config">
                    <View style={s.feesBoxHeader}>
                      <Feather name="credit-card" size={14} color="#1E40AF" />
                      <Text style={s.feesBoxTitle}>Fee breakdown · AY 2026-27</Text>
                    </View>
                    {(() => {
                      const ovNum: Record<string, number> = {};
                      for (const [k, v] of Object.entries(pwsOverrides)) {
                        const n = parseInt(v, 10);
                        if (!Number.isNaN(n)) ovNum[k] = n;
                      }
                      const amounts = resolveCategoryAmounts(pwsClass, transportEnabled, transportDistance, canOverrideFees ? ovNum : undefined);
                      return (
                        <>
                          <View style={s.feesReadonlyBox}>
                            {Object.entries(amounts).map(([cat, amt]) => (
                              <View key={cat} style={s.feesReadonlyRow}>
                                <Text style={s.feesReadonlyKey}>{cat}</Text>
                                <Text style={s.feesReadonlyVal}>₹{amt.toLocaleString("en-IN")}</Text>
                              </View>
                            ))}
                          </View>
                          {isNew && (
                            <Text style={s.feesBoxNote}>Fees auto-create on save. First-month tuition: admission on/before 15th = full; from 16th = 50%.</Text>
                          )}
                          {!isNew && (
                            <TouchableOpacity
                              style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
                              onPress={() => router.push(`/fees/pws-student/${id}` as any)}
                            >
                              <Feather name="calendar" size={14} color="#1E40AF" />
                              <Text style={{ color: "#1E40AF", fontWeight: "700" }}>Open yearly fee roadmap</Text>
                            </TouchableOpacity>
                          )}
                          {canOverrideFees && (
                            <>
                              <Text style={[s.label, { marginTop: 12 }]}>Override / Scholarship</Text>
                              {Object.keys(amounts).map((cat) => (
                                <View key={`ov-${cat}`}>
                                  <Text style={s.help}>{cat} (default ₹{amounts[cat].toLocaleString("en-IN")})</Text>
                                  <TextInput
                                    testID={`override-${cat.replace(/\s+/g, "-")}`}
                                    value={pwsOverrides[cat] || ""}
                                    onChangeText={(v) => setPwsOverrides((prev) => ({ ...prev, [cat]: v }))}
                                    keyboardType="numeric"
                                    placeholder="Leave blank for default"
                                    placeholderTextColor="#94A3B8"
                                    style={s.input}
                                  />
                                </View>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </View>
                </>
              )}
              {!isStudentKind && (
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchLabel}>Hostel resident</Text>
                  <Text style={s.switchHelp}>Include in hostel roll-call</Text>
                </View>
                <Switch testID="field-resident" value={isResident} onValueChange={setIsResident} trackColor={{ true: "#1E40AF" }} />
              </View>
              )}
            </>
          )}

          {isStaffKind && (
            <>
              <Text style={s.label}>Employee ID</Text>
              <TextInput testID="field-employee-id" editable={!readOnly} value={employeeId} onChangeText={setEmployeeId} placeholder="e.g. EMP-0001" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.label}>Role / Designation *</Text>
              <TextInput testID="field-group" editable={!readOnly} value={group} onChangeText={setGroup} placeholder="e.g. Canteen Supervisor, Librarian" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.label}>Department</Text>
              <TextInput testID="field-department" editable={!readOnly} value={staffDepartment} onChangeText={setStaffDepartment} placeholder="e.g. Administration, Sports" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.label}>Phone</Text>
              <TextInput testID="field-staff-phone" editable={!readOnly} value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="+91 …" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.label}>Email</Text>
              <TextInput testID="field-staff-email" editable={!readOnly} value={personEmail} onChangeText={setPersonEmail} autoCapitalize="none" keyboardType="email-address" placeholder="staff@email.com" placeholderTextColor="#94A3B8" style={[s.input, readOnly && s.readonly]} />
              <Text style={s.help}>Staff roster records — login accounts auto-created for Permissions sync.</Text>
              {organization === "ALPHA" && (
                <>
                  <Text style={s.label}>Assigned Centre *</Text>
                  <View style={s.chipRow}>
                    {CENTRES.map((c) => (
                      <TouchableOpacity key={c} testID={`staff-centre-${c}`} style={[s.chip, { flex: 1 }, centre === c && s.chipActive]} onPress={() => setCentre(c)}>
                        <Feather name="map-pin" size={14} color={centre === c ? "#fff" : "#475569"} />
                        <Text style={[s.chipText, centre === c && { color: "#fff" }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {!isUserKind && (
            <>
          <Text style={s.label}>Organization</Text>
          {isPlayerKind ? (
            <View style={[s.chip, { alignSelf: "flex-start", backgroundColor: "#DBEAFE", borderColor: "#93C5FD" }]} testID="org-locked-alpha">
              <Text style={[s.chipText, { color: "#1E40AF" }]}>ALPHA Sports Academy</Text>
            </View>
          ) : (
            <View style={s.chipRow}>
              {(isStaffKind ? (["PWS", "ALPHA"] as const) : ORGS).map((o) => (
                <TouchableOpacity key={o} testID={`org-${o}`} style={[s.chip, { flex: 1 }, organization === o && s.chipActive]} onPress={() => setOrganization(o as any)}>
                  <Text style={[s.chipText, organization === o && { color: "#fff" }]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
            </>
          )}
          {isCoachKind && isSuper && (
            <>
              <Text style={[s.label, { marginTop: 24 }]}>Coach editing rights</Text>
              <Text style={s.help}>Choose what this coach can do with players.</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {COACH_PERMS.map((p) => (
                  <TouchableOpacity key={p.key} testID={`cperm-${p.key}`} style={[s.permRow, coachPermissions.includes(p.key) && s.permRowActive]} onPress={() => toggleCoachPerm(p.key)}>
                    <View style={[s.checkBox, coachPermissions.includes(p.key) && { backgroundColor: "#1E40AF", borderColor: "#1E40AF" }]}>
                      {coachPermissions.includes(p.key) && <Feather name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={s.permText}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.label, { marginTop: 16 }]}>Assigned Centres</Text>
              <Text style={s.help}>Coach will see only players from these centres.</Text>
              <View style={[s.chipRow, { marginTop: 8 }]}>
                {CENTRES.map((c) => (
                  <TouchableOpacity key={c} testID={`acentre-${c}`} style={[s.chip, { flex: 1 }, assignedCentres.includes(c) && s.chipActive]} onPress={() => setAssignedCentres((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c])}>
                    <Text style={[s.chipText, assignedCentres.includes(c) && { color: "#fff" }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.label, { marginTop: 16 }]}>Assigned Sport *</Text>
              <Text style={s.help}>A coach can be assigned to one sport only. This controls which players they can access after signing in.</Text>
              <View style={s.chipRow}>
                {PLAYER_SPORTS.map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    testID={`asport-${sp}`}
                    style={[s.chip, { flex: 1 }, assignedSports[0] === sp && s.chipActive]}
                    onPress={() => {
                      setAssignedSports([sp]);
                      setAssignedSport(sp);
                    }}
                  >
                    <Text style={[s.chipText, assignedSports[0] === sp && { color: "#fff" }]}>{sp}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {isUserKind && !isCoachKind && isSuper && (
            <>
              <Text style={[s.label, { marginTop: 24 }]}>Editing rights (Admin only)</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {PERMS.map((p) => (
                  <TouchableOpacity key={p} testID={`perm-${p}`} style={[s.permRow, canManage.includes(p) && s.permRowActive]} onPress={() => togglePerm(p)}>
                    <View style={[s.checkBox, canManage.includes(p) && { backgroundColor: "#1E40AF", borderColor: "#1E40AF" }]}>
                      {canManage.includes(p) && <Feather name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={s.permText}>Manage {p}s</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {canLinkParents && (
            <View style={s.parentBox}>
              <View style={s.feesBoxHeader}>
                <Feather name="users" size={14} color="#7C3AED" />
                <Text style={s.parentBoxTitle}>Linked Parents</Text>
              </View>
              <Text style={s.feesBoxSub}>Parents linked here can see this {kindParam}'s attendance and fees from their parent portal.</Text>

              {parentUserIds.length === 0 && (
                <Text style={s.parentEmpty} testID="no-linked-parents">No parents linked yet.</Text>
              )}
              {parentUserIds.map((pid) => {
                const pu = parentUsers.find((x) => x.id === pid);
                return (
                  <View key={pid} style={s.parentRow} testID={`linked-parent-${pid}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.parentName}>{pu?.name || "Parent"}</Text>
                      <Text style={s.parentSub}>{pu?.mobile || pu?.email || pid.slice(0, 8)}</Text>
                    </View>
                    <TouchableOpacity testID={`unlink-parent-${pid}`} onPress={() => unlinkParent(pid, pu?.name || "this parent")} style={s.unlinkBtn}>
                      <Feather name="x" size={14} color="#DC2626" />
                      <Text style={s.unlinkTxt}>Unlink</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {!showParentPicker ? (
                <TouchableOpacity testID="link-parent-btn" onPress={() => setShowParentPicker(true)} style={s.linkParentBtn}>
                  <Feather name="plus" size={14} color="#7C3AED" />
                  <Text style={s.linkParentBtnTxt}>Link a parent</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: 10 }}>
                  <Text style={s.parentSub}>Select a parent account:</Text>
                  <View style={{ gap: 6, marginTop: 6, maxHeight: 220 }}>
                    {parentUsers.filter((x) => !parentUserIds.includes(x.id)).length === 0 && (
                      <Text style={s.parentEmpty}>No available parent accounts. Create one from Manage Users → Parents.</Text>
                    )}
                    {parentUsers.filter((x) => !parentUserIds.includes(x.id)).map((pu) => (
                      <TouchableOpacity key={pu.id} testID={`pick-parent-${pu.id}`} disabled={linkingParent} onPress={() => linkParent(pu.id)} style={s.coachOpt}>
                        <Text style={[s.coachOptText, { fontWeight: "700", color: "#0F172A" }]}>{pu.name}</Text>
                        <Text style={s.coachOptText}>{pu.mobile || pu.email || ""}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity testID="cancel-parent-picker" onPress={() => setShowParentPicker(false)} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                    <Text style={{ color: "#64748B", fontSize: 12, fontWeight: "700" }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View style={s.bottomBar}>
          {canEdit && (
          <TouchableOpacity testID="save-btn" onPress={save} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>{isNew ? "Create" : "Save changes"}</Text>}
          </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 18, fontWeight: "700", color: "#0F172A", textTransform: "capitalize", flex: 1 },
  delBtn: { padding: 8 },
  scroll: { padding: 20, paddingBottom: 120 },
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 16 },
  help: { fontSize: 12, color: "#64748B", marginTop: 2 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0F172A" },
  readonly: { backgroundColor: "#F8FAFC", color: "#64748B" },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipText: { fontWeight: "700", fontSize: 13, color: "#475569" },
  switchRow: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, marginTop: 16 },
  switchLabel: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  switchHelp: { fontSize: 12, color: "#64748B", marginTop: 2 },
  permRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  permRowActive: { borderColor: "#1E40AF", backgroundColor: "#EFF6FF" },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
  permText: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  coachList: { gap: 6, maxHeight: 180 },
  coachOpt: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  coachOptActive: { borderColor: "#1E40AF", backgroundColor: "#EFF6FF" },
  coachOptText: { color: "#475569", fontSize: 13 },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "#F4F5F7", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  saveBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  statusCard: { flexDirection: "row", alignItems: "center", marginTop: 18, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  statusLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", letterSpacing: 0.5 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start", marginTop: 6 },
  statusPillActive: { backgroundColor: "#DCFCE7" },
  statusPillDeact: { backgroundColor: "#F1F5F9" },
  statusPillTxt: { fontSize: 12, fontWeight: "800" },
  statusHelp: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  statusBtnTxt: { fontSize: 13, fontWeight: "700" },
  resetPwdBox: { marginTop: 12, padding: 12, backgroundColor: "#FEF3C7", borderRadius: 12, borderWidth: 1, borderColor: "#FCD34D" },
  resetPwdTitle: { color: "#92400E", fontSize: 13, fontWeight: "800" },
  resetPwdGo: { paddingHorizontal: 18, borderRadius: 10, backgroundColor: "#FDE68A", alignItems: "center", justifyContent: "center" },
  resetPwdTxt: { color: "#92400E", fontSize: 12, fontWeight: "700", flex: 1 },
  fieldHint: { fontSize: 11, color: "#94A3B8", marginTop: -6, marginBottom: 10, lineHeight: 15 },
  permBox: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, marginBottom: 14 },
  permHeadRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  permTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  permGroupLabel: { fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.8, marginBottom: 4 },
  permItemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
  permItemTxt: { fontSize: 13, color: "#475569" },
  feesBox: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 12, padding: 12, marginTop: 18 },
  feesBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feesBoxTitle: { fontSize: 12, fontWeight: "800", color: "#1E40AF", letterSpacing: 0.4, textTransform: "uppercase" },
  feesBoxSub: { fontSize: 11, color: "#475569", marginTop: 4, marginBottom: 6 },
  feesBoxNote: { fontSize: 11, color: "#1E40AF", marginTop: 4, fontStyle: "italic" },
  feesReadonlyBox: { backgroundColor: "#F8FAFC", padding: 10, borderRadius: 10, marginTop: 8 },
  feesReadonlyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  feesReadonlyKey: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  feesReadonlyVal: { fontSize: 12, color: "#0F172A", fontWeight: "800" },
  feesReadonlyLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  feesReadonlyLinkTxt: { fontSize: 11, color: "#1E40AF", fontWeight: "700" },
  dobHelp: { fontSize: 12, color: "#0F766E", marginTop: 6, fontWeight: "600" },
  adhocBox: { backgroundColor: "#F0FDFA", borderWidth: 1, borderColor: "#A7F3D0", borderRadius: 12, padding: 12, marginTop: 14 },
  adhocRow: { padding: 8, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#D1FAE5", marginTop: 8 },
  adhocChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  adhocChipActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  adhocChipTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },
  adhocAddBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#0F766E", backgroundColor: "#fff" },
  adhocAddBtnTxt: { fontSize: 12, fontWeight: "800", color: "#0F766E" },
  adhocRemoveBtn: { padding: 10, borderRadius: 8, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  parentBox: { backgroundColor: "#FAF5FF", borderWidth: 1, borderColor: "#E9D5FF", borderRadius: 12, padding: 12, marginTop: 18 },
  parentBoxTitle: { fontSize: 12, fontWeight: "800", color: "#7C3AED", letterSpacing: 0.4, textTransform: "uppercase" },
  parentEmpty: { fontSize: 12, color: "#94A3B8", fontStyle: "italic", marginTop: 8 },
  parentRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E9D5FF", borderRadius: 10, padding: 10, marginTop: 8, gap: 8 },
  parentName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  parentSub: { fontSize: 11, color: "#64748B", marginTop: 2 },
  unlinkBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: "#FEE2E2" },
  unlinkTxt: { fontSize: 11, fontWeight: "800", color: "#DC2626" },
  linkParentBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#7C3AED", backgroundColor: "#fff" },
  linkParentBtnTxt: { fontSize: 12, fontWeight: "800", color: "#7C3AED" },
  miniChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8, backgroundColor: "#fff" },
  miniChipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  miniChipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  miniChipTxtActive: { color: "#fff" },
});

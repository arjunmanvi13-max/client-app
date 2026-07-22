import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, usePathname, useNavigation } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { BusinessEntity, Permission } from "../../../src/rbac";
import {
  canOverridePwsFees, type PwsStudentType, type TransportDistance,
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
import { getManageListMeta, resolveManageId, resolveManageKind } from "../../../src/manageKinds";
import {
  DATE_PLACEHOLDER,
  dateHelpText,
  formatDate,
  isValidDisplayDate,
  parseToISO,
  toISODate,
} from "../../../src/dateFormat";
import { StudentRosterFormFields, resolveSectionMatch } from "../../../src/StudentRosterFormFields";
import { PlayerRosterFormFields, BOARDING_FLAT_MONTHLY_FEE, type PlayerType } from "../../../src/PlayerRosterFormFields";
import { CoachUserFormFields } from "../../../src/CoachUserFormFields";
import {
  TeacherUserFormFields,
  assignmentsToClassRows,
  buildTeacherPermissions,
  describeTeacherAllocationFailure,
  expandClassAllocations,
  isValidIndianMobile,
  isTeacherClassRowComplete,
  normalizeIndianMobile,
  type AcademicGrade,
  type AcademicSection,
  type AcademicSubject,
  type TeacherClassAllocationRow,
  type TeacherDesignation,
} from "../../../src/TeacherUserFormFields";
import { FormPageHeader } from "../../../src/components/forms/FormPageHeader";
import { UnsavedChangesModal } from "../../../src/components/forms/UnsavedChangesModal";
import {
  DeactivateUserConfirmModal,
  type UserStatusConfirmAction,
} from "../../../src/components/forms/DeactivateUserConfirmModal";
import { TeacherProfilePdfModal } from "../../../src/components/forms/TeacherProfilePdfModal";
import {
  buildTeacherFormSnapshot,
  isTeacherFormDirty,
  type TeacherFormSnapshot,
} from "../../../src/teachers/teacherFormState";
import { setManageDirectoryToast } from "../../../src/manageDirectoryToast";
import { formColors } from "../../../src/theme";
import { useDirtyLeaveGuard } from "../../../src/useDirtyLeaveGuard";
import { ErrorState } from "../../../src/ScreenStates";

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

function navigateToTeachersList(router: ReturnType<typeof useRouter>) {
  const href = "/manage/teacher";
  const go = () => router.replace(href);
  if (Platform.OS === "web") {
    setTimeout(go, 0);
    return;
  }
  go();
}

function navigateToManageUserList(router: ReturnType<typeof useRouter>, kind: string) {
  const href = `/manage/${kind}`;
  const go = () => router.replace(href);
  if (Platform.OS === "web") {
    setTimeout(go, 0);
    return;
  }
  go();
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
  const id = resolveManageId(resolveRouteParam(idRaw), pathname);
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const isNew = id === "new";
  const userTypeKind = isApprovedLoginUserType(kindParam) ? (kindParam as LoginUserType) : null;
  const rosterMeta = getManageListMeta(kindParam);
  const isLoginUserKind = !!userTypeKind;
  const isLegacyUserKind = rosterMeta?.isUser === true;
  const isRosterPersonKind = rosterMeta?.isUser === false;
  const typeCatalog = userTypeKind ? CATALOG_BY_CODE[userTypeKind] : null;
  const isUserKind = isLoginUserKind || isLegacyUserKind;
  const isCoachKind = userTypeKind === UserRole.ALPHA_COACH || kindParam === "coach";
  const isCoachUserForm = isCoachKind && isUserKind;
  const isTeacherKind = kindParam === "teacher";
  const isTeacherUserForm = isTeacherKind && isLegacyUserKind;
  const isManageUsersLoginForm = isLoginUserKind && !isCoachUserForm;
  const isStructuredUserForm = isCoachUserForm || isTeacherUserForm || isManageUsersLoginForm;
  const isPwsAdminKind = userTypeKind === UserRole.PWS_ADMIN;
  const isPlayerKind = kindParam === "player";
  const isStaffKind = kindParam === "staff";
  const isStudentKind = kindParam === "student";
  const displayTitle = typeCatalog?.displayName || rosterMeta?.label || kindParam || "User";
  const canConfirmLoginUserStatusChange = isLoginUserKind || isCoachUserForm;

  useEffect(() => {
    if (kindRaw === undefined) return;
    if (!userTypeKind && !rosterMeta) router.replace("/manage");
  }, [kindRaw, userTypeKind, rosterMeta, router]);

  const isSuper = user?.role === "super_admin" || user?.user_type === "super_admin"
    || userHasPermission(user, Permission.MANAGE_ACCESS);
  const canManageUsersRosters = userHasPermission(user, Permission.MANAGE_USERS_ROSTERS);
  const canAddNewTeacher = userHasPermission(user, Permission.ADD_NEW_TEACHER, BusinessEntity.PWS);
  const canManageTeachers = userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SECTIONS, BusinessEntity.PWS);
  const canToggleTeacherStatus = isSuper || canManageTeachers;
  const canDeleteTeacher = isTeacherUserForm && isSuper && !isNew;
  const isAdmin = userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA)
    || userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_ACCESS);
  const isTeacher = user?.role === "teacher";
  const canOverrideFees = canOverridePwsFees(user?.role);
  const perms = user?.permissions || {};
  const canEdit = (() => {
    if (isLoginUserKind) {
      if (isNew && userTypeKind === UserRole.PWS_TEACHER) {
        return canManageUsersRosters || canAddNewTeacher;
      }
      return canManageUsersRosters;
    }
    if (!rosterMeta) return false;
    if (isTeacherUserForm && isNew) return false;
    if (isNew) {
      if (isTeacher && isStudentKind) return false;
      if (isAdmin) return true;
      if (isStudentKind) return userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS);
      if (isPlayerKind) return userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA);
      if (isTeacherUserForm) return isSuper || canManageTeachers;
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
    if (isTeacherUserForm) return isSuper || canManageTeachers;
    if (isLegacyUserKind) return isAdmin;
    return (user?.can_manage || []).includes(kindParam);
  })();
  const canDelete = canEdit && !isNew && !isTeacherUserForm
    && (isAdmin || isStudentKind || isPlayerKind || isStaffKind || isLoginUserKind);
  const readOnly = !isNew && !canEdit;

  useEffect(() => {
    if (isNew && isTeacherUserForm) {
      router.replace("/manage/pws_teacher/new");
    }
  }, [isNew, isTeacherUserForm, router]);

  useEffect(() => {
    if (!isNew || userTypeKind !== UserRole.PWS_TEACHER) return;
    if (!canEdit) router.replace("/manage/pws_teacher");
  }, [isNew, userTypeKind, canEdit, router]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [recordFound, setRecordFound] = useState(isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Shared
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState<"PWS" | "ALPHA" | "BOTH">(
    (typeCatalog?.entityScope as "PWS" | "ALPHA" | "BOTH") || (isCoachKind ? "ALPHA" : "PWS"),
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
  const [assignedSport, setAssignedSport] = useState(isNew && isCoachKind ? "Cricket" : "");

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
  const [motherName, setMotherName] = useState("");
  const [age, setAge] = useState("");
  const [skillLevel, setSkillLevel] = useState<"Beginner" | "Intermediate" | "Advanced" | "">("");
  const [mobile, setMobile] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [slot, setSlot] = useState<"Morning" | "Evening" | "Both" | "">("");
  const [assignedCoachId, setAssignedCoachId] = useState<string | null>(null);
  const [centre, setCentre] = useState<"Balua" | "Harding Park" | "">("");
  const [playerType, setPlayerType] = useState<PlayerType | "">("");
  const [boardingClass, setBoardingClass] = useState("");
  const [boardingSectionLetter, setBoardingSectionLetter] = useState("");
  const [dateOfAdmission, setDateOfAdmission] = useState<string>(isNew && isPlayerKind ? formatDate(toISODate()) : "");
  const [dob, setDob] = useState<string>("");
  const [transportFeeMonthly, setTransportFeeMonthly] = useState<string>("");
  const [hostelFeeOverride, setHostelFeeOverride] = useState<string>("");
  const [monthlyFeeOverride, setMonthlyFeeOverride] = useState<string>("");
  const [registrationFeeOverride, setRegistrationFeeOverride] = useState<string>("");
  const [status, setStatus] = useState<"active" | "deactivated">("active");

  // Optional ad-hoc fee heads to create during admission (Super Admin only)
  const [adhocFees, setAdhocFees] = useState<{ fee_type: string; amount: string; due_date: string }[]>([]);
  const coachScope = resolveCoachDataScope(user);
  const coachSportLocked = false;
  const coachCreatingPlayer = false;

  // Coach centre/sport assignment (admin -> coach)
  const [designation, setDesignation] = useState<PwsAdminDesignation>("PRINCIPAL");
  const [assignedCentres, setAssignedCentres] = useState<string[]>([]);
  const [assignedSports, setAssignedSports] = useState<string[]>(isNew && isCoachKind ? ["Cricket"] : []);
  const [loadedUserType, setLoadedUserType] = useState<string | null>(null);
  const [loadedDesignation, setLoadedDesignation] = useState<PwsAdminDesignation | null>(null);

  // User-level status (coach/teacher activate-deactivate)
  const [userStatus, setUserStatus] = useState<"active" | "deactivated">("active");
  const [coachType, setCoachType] = useState<"head" | "assistant">("head");

  // Teacher profile
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [teacherDesignation, setTeacherDesignation] = useState<TeacherDesignation>("TEACHER");
  const [attendanceAllowed, setAttendanceAllowed] = useState(true);
  const [marksEntry, setMarksEntry] = useState(true);
  const [studentAssessment, setStudentAssessment] = useState(true);
  const [teacherClassRows, setTeacherClassRows] = useState<TeacherClassAllocationRow[]>([
    { key: "row-initial", className: "", sectionLetter: "", subjects: [] },
  ]);
  const [academicYearId, setAcademicYearId] = useState<string | null>(null);
  const [teacherGrades, setTeacherGrades] = useState<AcademicGrade[]>([]);
  const [teacherSections, setTeacherSections] = useState<AcademicSection[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<AcademicSubject[]>([]);
  const [academicLoading, setAcademicLoading] = useState(false);
  const [teacherBaseline, setTeacherBaseline] = useState<TeacherFormSnapshot | null>(null);
  const [teacherAssignmentsReady, setTeacherAssignmentsReady] = useState(false);
  const [hasLoginAccount, setHasLoginAccount] = useState(true);
  const [teacherPersonalEmail, setTeacherPersonalEmail] = useState("");
  const [teacherDateOfBirth, setTeacherDateOfBirth] = useState("");
  const [teacherQualification, setTeacherQualification] = useState("");
  const [teacherQualificationOther, setTeacherQualificationOther] = useState("");
  const [teacherLastJob, setTeacherLastJob] = useState("");
  const [teacherReferenceName, setTeacherReferenceName] = useState("");
  const [teacherReferenceMobile, setTeacherReferenceMobile] = useState("");
  const [teacherAadhaarMasked, setTeacherAadhaarMasked] = useState("");
  const [unsavedModalVisible, setUnsavedModalVisible] = useState(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<(() => void) | null>(null);
  const [loginUserStatusModal, setLoginUserStatusModal] = useState<UserStatusConfirmAction | null>(null);
  const [loginUserStatusBusy, setLoginUserStatusBusy] = useState(false);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [savedTeacherId, setSavedTeacherId] = useState<string | null>(null);
  const skipDirtyGuard = useRef(false);

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
      setLoadError(null);
      setTeacherBaseline(null);
      setTeacherAssignmentsReady(isTeacherUserForm && isNew);
      try {
        if (isUserKind) {
          let u: any = null;
          try {
            const params = userTypeKind
              ? { user_type: userTypeKind, include_deactivated: true }
              : { role: kindParam, include_deactivated: true };
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
              if (e?.response?.status === 405 || e?.response?.status === 404 || e?.response?.status === 403) {
                const fallbackParams: Record<string, string | boolean> = { include_deactivated: true };
                if (kindParam) fallbackParams.role = kindParam;
                const { data: all } = await api.get("/users", { params: fallbackParams });
                u = (Array.isArray(all) ? all : []).find((x: any) => x.id === id);
              } else {
                throw e;
              }
            }
          }
          if (!u && userTypeKind) {
            const { data: all } = await api.get("/users", { params: { include_deactivated: true } });
            u = filterUsersByType(Array.isArray(all) ? all : [], userTypeKind).find((x: any) => x.id === id);
          }
          if (u) {
            setRecordFound(true);
            setName(u.name || "");
            setEmail(u.email || "");
            setOrganization(u.organization);
            const loginReady = u.has_login_account !== false && !!u.email;
            setHasLoginAccount(loginReady);
            setTeacherPersonalEmail(u.personal_email || "");
            setTeacherDateOfBirth(u.date_of_birth ? formatDate(u.date_of_birth) : "");
            setTeacherQualification(u.qualification || "");
            setTeacherQualificationOther(u.qualification_other || "");
            setTeacherLastJob(u.last_job || "");
            setGuardianName(u.guardian_name || "");
            setGuardianPhone(u.guardian_mobile || "");
            setTeacherReferenceName(u.reference_name || "");
            setTeacherReferenceMobile(u.reference_mobile || "");
            setTeacherAadhaarMasked(u.aadhaar_number_masked || "");
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
            if (isTeacherUserForm) {
              setMobile(u.mobile || u.phone || "");
              setAddress(u.address || "");
              const dojDisplay = u.date_of_joining ? formatDate(u.date_of_joining) : "";
              setDateOfJoining(dojDisplay === "—" ? "" : dojDisplay);
              setTeacherDesignation((u.teacher_designation as TeacherDesignation) || "TEACHER");
              const perms = u.permissions || {};
              setAttendanceAllowed(!!perms.mark_student_attendance);
              setMarksEntry(!!perms.enter_academic_marks);
              setStudentAssessment(!!perms.view_academic_marks);
            }
            if (isCoachKind) setOrganization("ALPHA");
            else if (u.organization) setOrganization(u.organization);
            else if (typeCatalog) setOrganization(typeCatalog.entityScope);
          } else {
            setRecordFound(false);
            setLoadError("This record could not be found or you may not have permission to view it.");
          }
        } else if (isRosterPersonKind) {
          const { data: p } = await api.get(`/people/${id}`);
          if (p) {
            setRecordFound(true);
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
            setMotherName(p.mother_name || "");
            setAge(p.age ? String(p.age) : "");
            setSkillLevel(p.skill_level || "");
            setMobile(p.mobile || "");
            setLocality(p.locality || "");
            setCity(p.city || "");
            setSlot(p.slot || "");
            setAssignedCoachId(p.assigned_coach_id || null);
            setCentre(p.centre || "");
            setPlayerType(p.player_type === "Hostel" ? "Hostel Only" : (p.player_type || ""));
            if (p.player_type === "Boarding") {
              setBoardingClass(p.pws_class || "");
              const sectionMatch = (p.group || "").match(/-([A-F])$/i);
              setBoardingSectionLetter(sectionMatch ? sectionMatch[1].toUpperCase() : "");
            } else {
              setBoardingClass("");
              setBoardingSectionLetter("");
            }
            setDob(formatDate(p.dob || ""));
            setTransportFeeMonthly(p.transport_fee_monthly ? String(p.transport_fee_monthly) : "");
            setHostelFeeOverride(p.hostel_fee_override ? String(p.hostel_fee_override) : "");
            setMonthlyFeeOverride(p.monthly_fee_override ? String(p.monthly_fee_override) : "");
            setRegistrationFeeOverride(p.registration_fee_override ? String(p.registration_fee_override) : "");
            setDateOfAdmission(formatDate(p.date_of_admission || ""));
            setStatus(p.status === "deactivated" ? "deactivated" : "active");
            setParentUserIds(p.parent_user_ids || []);
          } else {
            setRecordFound(false);
            setLoadError("This record could not be found.");
          }
        }
      } catch (e: any) {
        setRecordFound(false);
        setLoadError(e?.response?.data?.detail || "Failed to load record");
        Alert.alert("Error", e?.response?.data?.detail || "Failed to load user");
      } finally { setLoading(false); }
    })();
  }, [id, kindParam, isNew, isUserKind, isPlayerKind, isRosterPersonKind, user, userTypeKind, typeCatalog, reloadNonce]);

  useEffect(() => {
    if (isStudentKind || isPlayerKind) {
      api.get("/academic/sections").then((r) => {
        setAcademicSections((r.data || []).map((sec: any) => ({ id: sec.id, label: sec.label })));
      }).catch(() => setAcademicSections([]));
    }
  }, [isStudentKind, isPlayerKind]);

  useEffect(() => {
    if (!isTeacherUserForm) return;
    let cancelled = false;
    (async () => {
      setAcademicLoading(true);
      try {
        const { data: years } = await api.get("/academic/years");
        const open = (years || []).find((y: any) => y.status === "open") || (years || [])[0];
        if (!open || cancelled) return;
        setAcademicYearId(open.id);
        const [gradesRes, sectionsRes, subjectsRes] = await Promise.all([
          api.get("/academic/grades", { params: { academic_year_id: open.id } }),
          api.get("/academic/sections", { params: { academic_year_id: open.id } }),
          api.get("/academic/subjects", { params: { academic_year_id: open.id } }),
        ]);
        if (cancelled) return;
        setTeacherGrades(gradesRes.data || []);
        setTeacherSections(sectionsRes.data || []);
        setTeacherSubjects(subjectsRes.data || []);
      } catch {
        if (!cancelled) {
          setTeacherGrades([]);
          setTeacherSections([]);
          setTeacherSubjects([]);
        }
      } finally {
        if (!cancelled) setAcademicLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isTeacherUserForm]);

  useEffect(() => {
    if (!isTeacherUserForm || isNew || !id || !academicYearId) {
      if (isTeacherUserForm && isNew) setTeacherAssignmentsReady(true);
      return;
    }
    setTeacherAssignmentsReady(false);
    api.get("/academic/class-assignments", {
      params: { teacher_user_id: id, academic_year_id: academicYearId },
    }).then((r) => {
      const rows = assignmentsToClassRows(r.data || [], teacherGrades, teacherSections, teacherSubjects);
      if (rows.length) setTeacherClassRows(rows);
    }).catch(() => {}).finally(() => setTeacherAssignmentsReady(true));
  }, [isTeacherUserForm, isNew, id, academicYearId, teacherGrades, teacherSections, teacherSubjects]);

  const teacherCurrentSnapshot = useMemo((): TeacherFormSnapshot => ({
    name,
    dateOfJoining,
    mobile,
    address,
    email,
    password,
    teacherDesignation,
    attendanceAllowed,
    marksEntry,
    studentAssessment,
    classRows: teacherClassRows,
  }), [
    name, dateOfJoining, mobile, address, email, password, teacherDesignation,
    attendanceAllowed, marksEntry, studentAssessment, teacherClassRows,
  ]);

  const teacherFormDirty = isTeacherUserForm && !readOnly
    && isTeacherFormDirty(teacherBaseline, teacherCurrentSnapshot);

  const captureTeacherBaseline = useCallback(() => {
    setTeacherBaseline(buildTeacherFormSnapshot({
      name,
      dateOfJoining,
      mobile,
      address,
      email,
      password: "",
      teacherDesignation,
      attendanceAllowed,
      marksEntry,
      studentAssessment,
      classRows: teacherClassRows,
    }));
  }, [
    name, dateOfJoining, mobile, address, email, teacherDesignation,
    attendanceAllowed, marksEntry, studentAssessment, teacherClassRows,
  ]);

  useEffect(() => {
    if (!isTeacherUserForm || isNew || loading || !teacherAssignmentsReady || teacherBaseline) return;
    captureTeacherBaseline();
  }, [
    isTeacherUserForm, isNew, loading, teacherAssignmentsReady, teacherBaseline, captureTeacherBaseline,
  ]);

  useEffect(() => {
    if (!isTeacherUserForm || !teacherFormDirty || Platform.OS !== "web") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (skipDirtyGuard.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isTeacherUserForm, teacherFormDirty]);

  const blockDirtyLeave = useCallback((continueLeave: () => void) => {
    setPendingLeaveAction(() => continueLeave);
    setUnsavedModalVisible(true);
  }, []);

  useDirtyLeaveGuard(
    isTeacherUserForm,
    teacherFormDirty,
    skipDirtyGuard,
    navigation,
    blockDirtyLeave,
  );

  const confirmLeaveIfDirty = (leave: () => void) => {
    if (!isTeacherUserForm || !teacherFormDirty || skipDirtyGuard.current) {
      leave();
      return;
    }
    setPendingLeaveAction(() => leave);
    setUnsavedModalVisible(true);
  };

  const onTeacherCancel = () => confirmLeaveIfDirty(() => router.back());

  const onUnsavedNo = () => {
    setUnsavedModalVisible(false);
    const action = pendingLeaveAction;
    setPendingLeaveAction(null);
    if (action) {
      skipDirtyGuard.current = true;
      action();
    }
  };

  const onUnsavedYes = () => {
    const action = pendingLeaveAction;
    setUnsavedModalVisible(false);
    setPendingLeaveAction(null);
    void save({ afterSave: action || undefined });
  };

  const syncTeacherClassAssignments = async (
    teacherId: string,
    rows: TeacherClassAllocationRow[],
    yearId: string,
    grades = teacherGrades,
    sections = teacherSections,
    subjects = teacherSubjects,
  ) => {
    const desired = expandClassAllocations(rows, grades, sections, subjects);
    const { data: existing } = await api.get("/academic/class-assignments", {
      params: { teacher_user_id: teacherId, academic_year_id: yearId },
    });
    const existingRows = Array.isArray(existing) ? existing : [];
    const desiredKeys = new Set(desired.map((d) => `${d.gradeId}:${d.sectionId}:${d.subjectId}`));
    const existingKeys = new Set(
      existingRows.map((a: any) => `${a.grade_id}:${a.section_id}:${a.subject_id}`),
    );
    for (const row of existingRows) {
      const key = `${row.grade_id}:${row.section_id}:${row.subject_id}`;
      if (!desiredKeys.has(key)) {
        await api.delete(`/academic/class-assignments/${row.id}`);
      }
    }
    for (const d of desired) {
      const key = `${d.gradeId}:${d.sectionId}:${d.subjectId}`;
      if (!existingKeys.has(key)) {
        await api.post("/academic/class-assignments", {
          teacher_user_id: teacherId,
          academic_year_id: yearId,
          grade_id: d.gradeId,
          section_id: d.sectionId,
          subject_id: d.subjectId,
        });
      }
    }
  };

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

  const toggleModulePerm = (key: string) => {
    setPermMap((prev) => {
      if (key === "enter_coach_assessments") {
        const next = !prev.enter_coach_assessments;
        return { ...prev, enter_coach_assessments: next, view_coach_assessments: next };
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const isModulePermChecked = (key: string) => {
    if (key === "enter_coach_assessments") return !!permMap.enter_coach_assessments;
    return !!permMap[key];
  };

  const save = async (options?: { afterSave?: () => void }) => {
    if (!isLoginUserKind && !isRosterPersonKind && !isLegacyUserKind) {
      showError("Invalid record type", "This form is not for a supported manage route.");
      return;
    }
    if (!name.trim()) { showError("Name required", "Enter the full name."); return; }
    if ((isLoginUserKind || isLegacyUserKind) && isNew && (!email.trim() || !password.trim())) { showError("Required fields", "Email and password are required."); return; }
    if (isCoachKind && isNew && assignedSports.length !== 1) {
      showError("Assigned sport required", "Select exactly one sport — Cricket or Football.");
      return;
    }
    if ((isLoginUserKind || isTeacherUserForm) && email.trim() && !email.trim().toLowerCase().endsWith("@prarambhika.com")) {
      Alert.alert("Invalid email", "Email must belong to the @prarambhika.com domain");
      return;
    }
    if (isTeacherUserForm) {
      if (hasLoginAccount && (!dateOfJoining || !isValidDisplayDate(dateOfJoining))) {
        showError("Invalid date", dateHelpText());
        return;
      }
      if (!mobile.trim() || !isValidIndianMobile(mobile)) {
        showError("Invalid mobile", "Enter a valid 10-digit Indian mobile number.");
        return;
      }
      const partialAllocation = teacherClassRows.some((row) => {
        const hasAny = !!row.className || !!row.sectionLetter || row.subjects.length > 0;
        return hasAny && !isTeacherClassRowComplete(row);
      });
      if (partialAllocation) {
        showError("Class allocation incomplete", "Each class card needs a class, section, and at least one subject.");
        return;
      }
      if (hasLoginAccount && !teacherClassRows.some(isTeacherClassRowComplete)) {
        showError("Class allocation required", "Assign at least one class with section and subjects.");
        return;
      }
      if (!academicYearId) {
        showError("Academic year missing", "Set up an open academic year before assigning classes.");
        return;
      }
    }
    if (isPlayerKind && playerType === "Boarding" && (!boardingClass.trim() || !boardingSectionLetter.trim())) {
      Alert.alert("Class and Section are required for Boarding players");
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
      let teacherAcademic: {
        grades: AcademicGrade[];
        sections: AcademicSection[];
        subjects: AcademicSubject[];
      } | null = null;

      if (isTeacherUserForm && academicYearId) {
        const [gRes, sRes, subRes] = await Promise.all([
          api.get("/academic/grades", { params: { academic_year_id: academicYearId } }),
          api.get("/academic/sections", { params: { academic_year_id: academicYearId } }),
          api.get("/academic/subjects", { params: { academic_year_id: academicYearId } }),
        ]);
        const grades = gRes.data || [];
        const sections = sRes.data || [];
        const subjects = subRes.data || [];
        for (const row of teacherClassRows.filter(isTeacherClassRowComplete)) {
          const reason = describeTeacherAllocationFailure(row, grades, sections, subjects);
          if (reason) {
            showError("Class allocation could not be saved", reason);
            return;
          }
        }
        const resolved = expandClassAllocations(teacherClassRows, grades, sections, subjects);
        if (resolved.length === 0) {
          showError(
            "Class allocation could not be saved",
            "Selections could not be matched to the academic structure. Ensure standards, sections, and subjects exist for the open academic year.",
          );
          return;
        }
        setTeacherGrades(grades);
        setTeacherSections(sections);
        setTeacherSubjects(subjects);
        teacherAcademic = { grades, sections, subjects };
      }

      if (isLoginUserKind && userTypeKind) {
        const scopeOrg = isCoachKind ? "ALPHA" : (typeCatalog?.entityScope || organization);
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
          if (canManageUsersRosters && email.trim()) body.email = email.trim().toLowerCase();
          if (isPwsAdminKind) {
            body.user_type = UserRole.PWS_ADMIN;
            body.designation = designation;
          }
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
            organization: isCoachKind ? "ALPHA" : organization,
            department: department || null,
            phone: phone || null,
          };
          if (isCoachKind) {
            body.user_type = UserRole.ALPHA_COACH;
            body.coach_permissions = coachPermissions;
            body.coach_type = coachType;
            body.assigned_centres = assignedCentres;
            body.assigned_sport = assignedSports[0] || null;
            body.assigned_sports = assignedSports[0] ? [assignedSports[0]] : [];
            if (isSuper && customizePerms) body.permissions = permMap;
          } else if (isTeacherUserForm) {
            body.user_type = UserRole.PWS_TEACHER;
            body.organization = "PWS";
            body.mobile = normalizeIndianMobile(mobile);
            body.date_of_joining = parseToISO(dateOfJoining) || dateOfJoining;
            body.address = address.trim() || null;
            body.teacher_designation = teacherDesignation;
            body.permissions = buildTeacherPermissions(attendanceAllowed, marksEntry, studentAssessment);
          } else {
            body.role = kindParam;
            if (isAdmin && customizePerms) body.permissions = permMap;
            if (isAdmin) body.can_manage = canManage;
          }
          const { data: created } = await api.post("/users", body);
          if (isTeacherUserForm && academicYearId && teacherAcademic) {
            await syncTeacherClassAssignments(
              created.id,
              teacherClassRows,
              academicYearId,
              teacherAcademic.grades,
              teacherAcademic.sections,
              teacherAcademic.subjects,
            );
          }
        } else {
          const body: any = { name, organization: isCoachKind ? "ALPHA" : organization, department: department || null, phone: phone || null };
          if (password) body.password = password;
          if (isAdmin && email.trim()) body.email = email.trim().toLowerCase();
          if (isTeacherUserForm) {
            body.mobile = normalizeIndianMobile(mobile);
            body.date_of_joining = parseToISO(dateOfJoining) || dateOfJoining;
            body.address = address.trim() || null;
            body.teacher_designation = teacherDesignation;
            body.permissions = buildTeacherPermissions(attendanceAllowed, marksEntry, studentAssessment);
          }
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
          if (isTeacherUserForm && academicYearId && teacherAcademic) {
            await syncTeacherClassAssignments(
              id,
              teacherClassRows,
              academicYearId,
              teacherAcademic.grades,
              teacherAcademic.sections,
              teacherAcademic.subjects,
            );
          }
        }
      } else if (isPlayerKind) {
        const isHostelType = playerType === "Hostel Only" || playerType === "Boarding";
        const body: any = {
          name, kind: "player", organization: "ALPHA",
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
        if (playerType === "Boarding") {
          // Boarding players carry PWS student attributes (class/section) — synced with the PWS Student List roster.
          body.pws_class = boardingClass;
          body.pws_student_type = "Boarding";
          const { id: boardingSectionId, label: boardingGroup } = resolveSectionMatch(
            boardingClass,
            boardingSectionLetter,
            academicSections,
          );
          if (boardingSectionId) body.section_id = boardingSectionId;
          body.group = boardingGroup;
          body.pws_fee_overrides = { Tuition: BOARDING_FLAT_MONTHLY_FEE };
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
          father_name: guardianName || fatherName || null,
          mother_name: motherName || null,
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
      if (isTeacherUserForm && !isNew) {
        skipDirtyGuard.current = true;
        setTeacherBaseline(buildTeacherFormSnapshot({
          ...teacherCurrentSnapshot,
          password: "",
        }));
        setSavedTeacherId(id);
        if (options?.afterSave) setPendingLeaveAction(options.afterSave);
        setPdfPreviewVisible(true);
        return;
      }
      router.back();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const message = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join("\n")
          : "Failed to save";
      const isDuplicate = typeof message === "string" && message.toLowerCase().includes("name and date of birth");
      showError(isDuplicate ? "Duplicate entry" : "Error", message);
    } finally { setSaving(false); }
  };

  const onDelete = () => {
    if (isNew) return;
    if (isTeacherUserForm) return;
    if (canConfirmLoginUserStatusChange && userStatus === "active" && canManageUsersRosters) {
      setLoginUserStatusModal("deactivate");
      return;
    }
    confirmAction("Delete?", `This ${displayTitle} account will be permanently removed.`, async () => {
      try {
        if (isUserKind) await api.delete(`/users/${id}`);
        else await api.delete(`/people/${id}`);
        router.back();
      } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    });
  };

  const onDeleteTeacher = () => {
    if (!canDeleteTeacher || isNew || !isSuper) return;
    confirmAction(
      "Delete teacher?",
      "This teacher account will be permanently removed.",
      async () => {
        try {
          await api.delete(`/users/${id}`);
          setManageDirectoryToast("Teacher deleted successfully.");
          skipDirtyGuard.current = true;
          navigateToTeachersList(router);
        } catch (e: any) {
          showError("Error", e?.response?.data?.detail || "Failed to delete teacher");
        }
      },
    );
  };

  const onPdfPreviewDone = () => {
    setPdfPreviewVisible(false);
    const action = pendingLeaveAction;
    setPendingLeaveAction(null);
    if (action) {
      skipDirtyGuard.current = true;
      action();
    }
  };

  const onLoginUserStatusAction = (action: UserStatusConfirmAction) => {
    if (!canConfirmLoginUserStatusChange || isNew || !canManageUsersRosters) return;
    if (action === "deactivate" && userStatus !== "active") return;
    if (action === "reactivate" && userStatus !== "deactivated") return;
    setLoginUserStatusModal(action);
  };

  const onConfirmLoginUserStatusAction = async () => {
    if (!loginUserStatusModal || loginUserStatusBusy) return;
    setLoginUserStatusBusy(true);
    const endpoint = loginUserStatusModal === "deactivate" ? "deactivate" : "activate";
    try {
      await api.post(`/users/${id}/${endpoint}`);
      skipDirtyGuard.current = true;
      setLoginUserStatusModal(null);
      navigateToManageUserList(router, kindParam);
    } catch (e: any) {
      const fallback = loginUserStatusModal === "deactivate" ? "Failed to deactivate user" : "Failed to reactivate user";
      showError("Error", e?.response?.data?.detail || fallback);
    } finally {
      setLoginUserStatusBusy(false);
    }
  };

  const onCancelLoginUserStatusAction = () => {
    if (loginUserStatusBusy) return;
    setLoginUserStatusModal(null);
  };

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} /></SafeAreaView>;

  if (!isNew && !recordFound) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="edit-back">
            <Feather name="x" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.h1}>Teacher not found</Text>
        </View>
        <View style={{ padding: 16 }}>
          <ErrorState
            message={loadError || "This teacher could not be loaded."}
            onRetry={() => {
              setRecordFound(false);
              setLoadError(null);
              setLoading(true);
              setReloadNonce((n) => n + 1);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, (isStudentKind || isStructuredUserForm) && s.safeStudent]} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {!isStudentKind && !isStructuredUserForm && (
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
        )}

        <ScrollView contentContainerStyle={(isStudentKind || isStructuredUserForm) ? s.scrollStudent : isPlayerKind ? s.scrollPlayer : s.scroll}>
          {isCoachUserForm && (
            <FormPageHeader
              breadcrumb="SYSTEM & SETTINGS · ALPHA COACHES"
              title={isNew ? "New ALPHA Coach" : readOnly ? `View ${displayTitle}` : `Edit ${displayTitle}`}
              onCancel={() => router.back()}
              onSave={canEdit ? save : undefined}
              saving={saving}
              saveLabel={isNew ? "Create" : "Save changes"}
              readOnly={readOnly}
            />
          )}

          {isManageUsersLoginForm && (
            <FormPageHeader
              breadcrumb="SYSTEM & SETTINGS · MANAGE USERS & ROSTERS"
              title={isNew ? `New ${displayTitle}` : readOnly ? `View ${displayTitle}` : `Edit ${displayTitle}`}
              onCancel={() => router.back()}
              onSave={canEdit ? save : undefined}
              saving={saving}
              saveLabel={isNew ? "Create" : "Save changes"}
              readOnly={readOnly}
              testID="manage-users-form-header"
            />
          )}

          {isStudentKind && (
            <FormPageHeader
              breadcrumb="DIRECTORY · STUDENTS"
              title={isNew ? "Add New Student" : readOnly ? "View Student" : "Edit Student"}
              onCancel={() => router.back()}
              onSave={canEdit ? save : undefined}
              saving={saving}
              saveLabel={isNew ? "Save Student" : "Save changes"}
              readOnly={readOnly}
            />
          )}

          {isCoachUserForm && (
            <CoachUserFormFields
              readOnly={readOnly}
              isNew={isNew}
              isSuper={isSuper}
              displayTitle={displayTitle}
              userTypeKind={userTypeKind}
              entityScope={isCoachKind ? "ALPHA" : (typeCatalog?.entityScope || organization)}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              phone={phone}
              setPhone={setPhone}
              assignedSports={assignedSports}
              setAssignedSports={setAssignedSports}
              setAssignedSport={setAssignedSport}
              assignedCentres={assignedCentres}
              setAssignedCentres={setAssignedCentres}
              coachPermissions={coachPermissions}
              toggleCoachPerm={toggleCoachPerm}
              customizePerms={customizePerms}
              setCustomizePerms={setCustomizePerms}
              permMap={permMap}
              setPermMap={setPermMap}
              userStatus={userStatus}
              onToggleUserStatus={!isNew && canManageUsersRosters ? () => {
                onLoginUserStatusAction(userStatus === "active" ? "deactivate" : "reactivate");
              } : undefined}
              resetPwdVal={resetPwdVal}
              setResetPwdVal={setResetPwdVal}
              onResetPassword={!isNew && canManageUsersRosters ? async () => {
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
              } : undefined}
              resetBusy={resetBusy}
            />
          )}

          {isTeacherUserForm && (
            <FormPageHeader
              breadcrumb="DIRECTORY · TEACHERS"
              title={isNew ? "New Teacher" : readOnly ? `View ${displayTitle}` : `Edit ${displayTitle}`}
              onCancel={onTeacherCancel}
              onSave={canEdit ? () => save() : undefined}
              saving={saving}
              saveLabel={isNew ? "Create" : "Save changes"}
              readOnly={readOnly}
            />
          )}

          {isTeacherUserForm && (
            <TeacherUserFormFields
              readOnly={readOnly}
              isNew={isNew}
              isSuper={isSuper}
              canToggleStatus={canToggleTeacherStatus}
              canDeleteTeacher={canDeleteTeacher}
              onDeleteTeacher={canDeleteTeacher ? onDeleteTeacher : undefined}
              displayTitle={displayTitle}
              userTypeKind={null}
              entityScope="PWS"
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              dateOfJoining={dateOfJoining}
              setDateOfJoining={setDateOfJoining}
              mobile={mobile}
              setMobile={setMobile}
              address={address}
              setAddress={setAddress}
              teacherDesignation={teacherDesignation}
              setTeacherDesignation={setTeacherDesignation}
              attendanceAllowed={attendanceAllowed}
              setAttendanceAllowed={setAttendanceAllowed}
              marksEntry={marksEntry}
              setMarksEntry={setMarksEntry}
              studentAssessment={studentAssessment}
              setStudentAssessment={setStudentAssessment}
              classRows={teacherClassRows}
              setClassRows={setTeacherClassRows}
              grades={teacherGrades}
              sections={teacherSections}
              subjects={teacherSubjects}
              academicLoading={academicLoading}
              userStatus={userStatus}
              onToggleUserStatus={!isNew && canToggleTeacherStatus ? () => {
                const next = userStatus === "active" ? "deactivated" : "active";
                const verb = next === "active" ? "Reactivate" : "Deactivate";
                confirmAction(`${verb} ${displayTitle}?`, `${verb} this account. ${next === "deactivated" ? "They will lose login access immediately." : "Login restored; user will appear in lists again."}`, async () => {
                  try {
                    await api.post(`/users/${id}/${next === "active" ? "activate" : "deactivate"}`);
                    setUserStatus(next);
                    Alert.alert("Done", `Teacher ${next === "active" ? "reactivated" : "deactivated"}.`);
                  } catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
                });
              } : undefined}
              resetPwdVal={resetPwdVal}
              setResetPwdVal={setResetPwdVal}
              onResetPassword={!isNew && isSuper ? async () => {
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
              } : undefined}
              resetBusy={resetBusy}
              hasLoginAccount={hasLoginAccount}
              personalEmail={teacherPersonalEmail}
              dateOfBirth={teacherDateOfBirth === "—" ? "" : teacherDateOfBirth}
              qualification={teacherQualification}
              qualificationOther={teacherQualificationOther}
              lastJob={teacherLastJob}
              guardianName={guardianName}
              guardianMobile={guardianPhone}
              referenceName={teacherReferenceName}
              referenceMobile={teacherReferenceMobile}
              aadhaarMasked={teacherAadhaarMasked}
            />
          )}

          {!isStudentKind && !isPlayerKind && !isCoachUserForm && !isTeacherUserForm && (
            <>
              <Text style={s.label}>Name *</Text>
              <TextInput testID="field-name" value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#94A3B8" style={s.input} />
            </>
          )}

          {isPlayerKind && (
            <PlayerRosterFormFields
              readOnly={readOnly}
              isNew={isNew}
              isSuper={isSuper}
              id={id}
              name={name}
              setName={setName}
              playerId={playerId}
              setPlayerId={setPlayerId}
              dob={dob}
              setDob={setDob}
              mobile={mobile}
              setMobile={setMobile}
              locality={locality}
              setLocality={setLocality}
              city={city}
              setCity={setCity}
              centre={centre}
              setCentre={setCentre}
              playerType={playerType}
              setPlayerType={setPlayerType}
              sport={sport}
              setSport={setSport}
              skillLevel={skillLevel}
              setSkillLevel={setSkillLevel}
              slot={slot}
              setSlot={setSlot}
              dateOfAdmission={dateOfAdmission}
              setDateOfAdmission={setDateOfAdmission}
              guardianName={guardianName}
              setGuardianName={setGuardianName}
              setFatherName={setFatherName}
              guardianPhone={guardianPhone}
              setGuardianPhone={setGuardianPhone}
              transportFeeMonthly={transportFeeMonthly}
              setTransportFeeMonthly={setTransportFeeMonthly}
              registrationFeeOverride={registrationFeeOverride}
              setRegistrationFeeOverride={setRegistrationFeeOverride}
              monthlyFeeOverride={monthlyFeeOverride}
              setMonthlyFeeOverride={setMonthlyFeeOverride}
              hostelFeeOverride={hostelFeeOverride}
              setHostelFeeOverride={setHostelFeeOverride}
              adhocFees={adhocFees}
              setAdhocFees={setAdhocFees}
              coachSportLocked={coachSportLocked}
              coachAssignedSport={coachScope.assignedSport}
              status={status}
              setStatus={setStatus}
              boardingClass={boardingClass}
              setBoardingClass={setBoardingClass}
              boardingSectionLetter={boardingSectionLetter}
              setBoardingSectionLetter={setBoardingSectionLetter}
            />
          )}

          {isStudentKind && (
            <StudentRosterFormFields
              readOnly={readOnly}
              isNew={isNew}
              id={id}
              name={name}
              setName={setName}
              gender={gender}
              setGender={setGender}
              dob={dob}
              setDob={setDob}
              mobile={mobile}
              setMobile={setMobile}
              personEmail={personEmail}
              setPersonEmail={setPersonEmail}
              address={address}
              setAddress={setAddress}
              admissionNumber={admissionNumber}
              setAdmissionNumber={setAdmissionNumber}
              playerId={playerId}
              rollNumber={rollNumber}
              setRollNumber={setRollNumber}
              dateOfAdmission={dateOfAdmission}
              setDateOfAdmission={setDateOfAdmission}
              pwsClass={pwsClass}
              setPwsClass={setPwsClass}
              sectionId={sectionId}
              setSectionId={setSectionId}
              group={group}
              setGroup={setGroup}
              academicSections={academicSections}
              pwsStudentType={pwsStudentType}
              setPwsStudentType={setPwsStudentType}
              setIsResident={setIsResident}
              organization={organization}
              setOrganization={setOrganization}
              transportEnabled={transportEnabled}
              setTransportEnabled={setTransportEnabled}
              transportDistance={transportDistance}
              setTransportDistance={setTransportDistance}
              guardianName={guardianName}
              setGuardianName={setGuardianName}
              motherName={motherName}
              setMotherName={setMotherName}
              guardianPhone={guardianPhone}
              setGuardianPhone={setGuardianPhone}
              pwsOverrides={pwsOverrides}
              setPwsOverrides={setPwsOverrides}
              canOverrideFees={canOverrideFees}
            />
          )}

          {isLoginUserKind && !isCoachUserForm && (
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
                  <Text style={s.label}>User Category</Text>
                  <View style={[s.chip, { alignSelf: "flex-start", backgroundColor: "#DBEAFE", borderColor: "#93C5FD" }]} testID="field-user-category">
                    <Text style={[s.chipText, { color: "#1E40AF" }]}>PWS Admin</Text>
                  </View>
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

          {(isLoginUserKind || (isLegacyUserKind && !isTeacherUserForm)) && !isCoachUserForm && (
            <>
              <Text style={s.label}>Email * (@prarambhika.com)</Text>
              <TextInput testID="field-email" value={email} onChangeText={setEmail} editable={isNew || canManageUsersRosters} autoCapitalize="none" keyboardType="email-address" placeholder="name@prarambhika.com" placeholderTextColor="#94A3B8" style={[s.input, !isNew && !canManageUsersRosters && { backgroundColor: "#F1F5F9", color: "#94A3B8" }]} />
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
                          onPress={() => toggleModulePerm(it.key)}
                        >
                          <Feather name={isModulePermChecked(it.key) ? "check-square" : "square"} size={18} color={isModulePermChecked(it.key) ? "#1E40AF" : "#94A3B8"} />
                          <Text style={[s.permItemTxt, isModulePermChecked(it.key) && { color: "#0F172A", fontWeight: "700" }]}>{it.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              )}

              {!isNew && canManageUsersRosters && (
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
                      if (canConfirmLoginUserStatusChange) {
                        onLoginUserStatusAction(userStatus === "active" ? "deactivate" : "reactivate");
                        return;
                      }
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
              {!isNew && canManageUsersRosters && (
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


          {!isUserKind && !isPlayerKind && !isStaffKind && !isStudentKind && (
            <>
              <Text style={s.label}>Group</Text>
              <TextInput testID="field-group" value={group} onChangeText={setGroup} placeholder="Group" placeholderTextColor="#94A3B8" style={s.input} />
              <View style={s.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.switchLabel}>Hostel resident</Text>
                  <Text style={s.switchHelp}>Include in hostel roll-call</Text>
                </View>
                <Switch testID="field-resident" value={isResident} onValueChange={setIsResident} trackColor={{ true: "#1E40AF" }} />
              </View>
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

          {!isUserKind && !isStudentKind && !isPlayerKind && (
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
          {isCoachKind && isSuper && !isCoachUserForm && (
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

        {!isStudentKind && !isStructuredUserForm && (
        <View style={s.bottomBar}>
          {canEdit && (
            <View style={s.bottomBarInner}>
              <TouchableOpacity testID="cancel-btn" onPress={() => router.back()} style={s.cancelBtn}>
                <Text style={s.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <Pressable
                testID="save-btn"
                onPress={save}
                disabled={saving}
                style={({ pressed, hovered }) => [
                  s.saveBtnPrimary,
                  saving && s.saveBtnDisabled,
                  (pressed || (Platform.OS === "web" && hovered)) && !saving && s.saveBtnHovered,
                ]}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>{isNew ? "Create" : "Save changes"}</Text>}
              </Pressable>
            </View>
          )}
        </View>
        )}
      </KeyboardAvoidingView>

      <UnsavedChangesModal
        visible={unsavedModalVisible}
        onYes={onUnsavedYes}
        onNo={onUnsavedNo}
        onDismiss={onUnsavedNo}
      />

      <DeactivateUserConfirmModal
        visible={loginUserStatusModal !== null}
        action={loginUserStatusModal ?? "deactivate"}
        loading={loginUserStatusBusy}
        onYes={() => { void onConfirmLoginUserStatusAction(); }}
        onNo={onCancelLoginUserStatusAction}
      />

      <TeacherProfilePdfModal
        visible={pdfPreviewVisible}
        userId={savedTeacherId || id}
        teacherName={name}
        onClose={() => setPdfPreviewVisible(false)}
        onDone={onPdfPreviewDone}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  safeStudent: { backgroundColor: formColors.pageBg },
  scrollStudent: { padding: 24, paddingBottom: 48, maxWidth: 1200, alignSelf: "center", width: "100%" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 18, fontWeight: "700", color: "#0F172A", textTransform: "capitalize", flex: 1 },
  delBtn: { padding: 8 },
  scroll: { padding: 20, paddingBottom: 120 },
  scrollPlayer: {
    padding: 24,
    paddingBottom: 120,
    maxWidth: 960,
    alignSelf: "center",
    width: "100%",
  },
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
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    ...Platform.select({
      web: { boxShadow: "0 -4px 16px rgba(15, 23, 42, 0.06)" } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
        elevation: 8,
      },
    }),
  },
  bottomBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    maxWidth: 960,
    alignSelf: "center",
    width: "100%",
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  cancelTxt: { fontSize: 15, fontWeight: "700", color: "#64748B" },
  saveBtnPrimary: {
    backgroundColor: "#1E40AF",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    minHeight: 46,
    ...Platform.select({ web: { cursor: "pointer" } as object }),
  },
  saveBtnHovered: { backgroundColor: "#1D4ED8" },
  saveBtnDisabled: { opacity: 0.6 },
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

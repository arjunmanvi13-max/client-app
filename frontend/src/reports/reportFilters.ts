import type { FormSelectOption } from "../components/forms/FormSelect";
import {
  PWS_CLASS_OPTIONS,
  SECTION_LETTERS,
} from "../StudentRosterFormFields";
import { PWS_STUDENT_TYPES } from "../pwsFeeStructure";

export type ReportId =
  | "students"
  | "players"
  | "staff"
  | "attendance-summary"
  | "attendance-detail"
  | "fee-collection"
  | "outstanding-invoices"
  | "payment-receipts"
  | "marks-summary"
  | "report-card-status";

export type EntityScope = "BOTH" | "ALPHA" | "PWS";
export type FeeCollectionType = "daily_collection" | "historical_due" | "monthly_collection" | "monthly_due";

export type AdvancedFilterState = {
  centre: string;
  sport: string;
  playerCategory: string;
  pwsClass: string;
  sectionLetter: string;
  status: string;
  paymentMethod: string;
  feeCollectionType: FeeCollectionType;
  pwsStudentType: string;
  department: string;
  designation: string;
  employmentType: string;
  shift: string;
};

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilterState = {
  centre: "All",
  sport: "All",
  playerCategory: "All",
  pwsClass: "All",
  sectionLetter: "All",
  status: "All",
  paymentMethod: "All",
  feeCollectionType: "monthly_collection",
  pwsStudentType: "All",
  department: "All",
  designation: "All",
  employmentType: "All",
  shift: "All",
};

export type ReportFilterKey =
  | "feeCollectionType"
  | "paymentMethod"
  | "pwsStudentType"
  | "pwsClass"
  | "sectionLetter"
  | "sport"
  | "playerCategory"
  | "centre"
  | "attendanceStatus"
  | "invoiceStatus"
  | "personStatus"
  | "department"
  | "designation"
  | "employmentType"
  | "shift"
  | "customPeriod";

const PWS_ONLY_REPORTS = new Set<ReportId>(["students", "marks-summary", "report-card-status"]);

const ALL_OPTION = (label: string): FormSelectOption => ({ value: "All", label });

const FEE_COLLECTION_TYPE_OPTIONS: FormSelectOption[] = [
  { value: "daily_collection", label: "Daily Collection" },
  { value: "historical_due", label: "Historical Due" },
  { value: "monthly_collection", label: "Monthly Collection" },
  { value: "monthly_due", label: "Monthly Due" },
];

const PAYMENT_METHOD_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All methods"),
  { value: "Cash", label: "Cash" },
  { value: "Online", label: "Online" },
  { value: "UPI", label: "UPI" },
  { value: "Cheque", label: "Cheque" },
];

const PWS_STUDENT_TYPE_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All types"),
  ...PWS_STUDENT_TYPES.map((t) => ({ value: t, label: t })),
];

const CLASS_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All classes"),
  ...PWS_CLASS_OPTIONS.map((c) => ({ value: c, label: c })),
];

const SECTION_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All sections"),
  ...SECTION_LETTERS.map((l) => ({ value: l, label: l })),
];

const SPORT_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All sports"),
  { value: "Cricket", label: "Cricket" },
  { value: "Football", label: "Football" },
];

const CENTRE_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All centres"),
  { value: "Balua", label: "Balua" },
  { value: "Harding Park", label: "Harding Park" },
];

const PLAYER_CATEGORY_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All categories"),
  { value: "Daily", label: "Daily" },
  { value: "Hostel Only", label: "Hostel Only" },
  { value: "Day Boarding", label: "Day Boarding" },
  { value: "Boarding", label: "Boarding" },
];

const ATTENDANCE_STATUS_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All statuses"),
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "leave", label: "Leave" },
];

const INVOICE_STATUS_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All statuses"),
  { value: "issued", label: "Issued" },
  { value: "overdue", label: "Overdue" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
];

const PERSON_STATUS_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All statuses"),
  { value: "active", label: "Active" },
  { value: "deactivated", label: "Deactivated" },
];

const DEPARTMENT_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All departments"),
  { value: "Administration", label: "Administration" },
  { value: "Sports", label: "Sports" },
  { value: "Canteen", label: "Canteen" },
  { value: "Hostel", label: "Hostel" },
  { value: "Library", label: "Library" },
  { value: "Laboratory", label: "Laboratory" },
  { value: "Grounds", label: "Grounds" },
];

const DESIGNATION_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All designations"),
  { value: "Canteen Supervisor", label: "Canteen Supervisor" },
  { value: "Lab Assistant", label: "Lab Assistant" },
  { value: "Librarian", label: "Librarian" },
  { value: "Groundsman", label: "Groundsman" },
  { value: "Kit Manager", label: "Kit Manager" },
  { value: "Physio", label: "Physio" },
  { value: "Cleaner", label: "Cleaner" },
  { value: "Head Cleaner", label: "Head Cleaner" },
];

const EMPLOYMENT_TYPE_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All types"),
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
];

const SHIFT_OPTIONS: FormSelectOption[] = [
  ALL_OPTION("All shifts"),
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

export type ReportFilterField = {
  key: ReportFilterKey;
  label: string;
  stateKey: keyof AdvancedFilterState;
  options: FormSelectOption[];
  testID: string;
  hint?: string;
};

const FILTER_FIELDS: Record<ReportFilterKey, Omit<ReportFilterField, "key">> = {
  feeCollectionType: {
    label: "Collection & due type",
    stateKey: "feeCollectionType",
    options: FEE_COLLECTION_TYPE_OPTIONS,
    testID: "fee-collection-type",
    hint: "Use Custom period for Historical Due calculations.",
  },
  paymentMethod: {
    label: "Payment method",
    stateKey: "paymentMethod",
    options: PAYMENT_METHOD_OPTIONS,
    testID: "payment-method",
  },
  pwsStudentType: {
    label: "Student type",
    stateKey: "pwsStudentType",
    options: PWS_STUDENT_TYPE_OPTIONS,
    testID: "pws-student-type",
  },
  pwsClass: {
    label: "Class",
    stateKey: "pwsClass",
    options: CLASS_OPTIONS,
    testID: "class",
  },
  sectionLetter: {
    label: "Section",
    stateKey: "sectionLetter",
    options: SECTION_OPTIONS,
    testID: "section",
  },
  sport: {
    label: "Sport",
    stateKey: "sport",
    options: SPORT_OPTIONS,
    testID: "sport",
  },
  playerCategory: {
    label: "Player category",
    stateKey: "playerCategory",
    options: PLAYER_CATEGORY_OPTIONS,
    testID: "player-category",
  },
  centre: {
    label: "Centre",
    stateKey: "centre",
    options: CENTRE_OPTIONS,
    testID: "centre",
  },
  attendanceStatus: {
    label: "Attendance status",
    stateKey: "status",
    options: ATTENDANCE_STATUS_OPTIONS,
    testID: "att-status",
  },
  invoiceStatus: {
    label: "Invoice status",
    stateKey: "status",
    options: INVOICE_STATUS_OPTIONS,
    testID: "status",
  },
  personStatus: {
    label: "Status",
    stateKey: "status",
    options: PERSON_STATUS_OPTIONS,
    testID: "person-status",
  },
  department: {
    label: "Department",
    stateKey: "department",
    options: DEPARTMENT_OPTIONS,
    testID: "staff-department",
  },
  designation: {
    label: "Designation",
    stateKey: "designation",
    options: DESIGNATION_OPTIONS,
    testID: "staff-designation",
  },
  employmentType: {
    label: "Employment type",
    stateKey: "employmentType",
    options: EMPLOYMENT_TYPE_OPTIONS,
    testID: "staff-employment-type",
  },
  shift: {
    label: "Shift",
    stateKey: "shift",
    options: SHIFT_OPTIONS,
    testID: "staff-shift",
  },
  customPeriod: {
    label: "Custom period",
    stateKey: "status",
    options: [],
    testID: "custom-period",
  },
};

/** Strict report → filter mapping with entity-aware sections. */
export function resolveReportFilterKeys(reportId: ReportId, entity: EntityScope): ReportFilterKey[] {
  switch (reportId) {
    case "fee-collection": {
      const keys: ReportFilterKey[] = ["feeCollectionType", "paymentMethod"];
      if (entity === "PWS" || entity === "BOTH") {
        keys.push("pwsStudentType", "pwsClass", "sectionLetter");
      }
      if (entity === "ALPHA" || entity === "BOTH") {
        keys.push("sport", "playerCategory", "centre");
      }
      return keys;
    }
    case "staff": {
      const keys: ReportFilterKey[] = ["department", "designation", "personStatus", "employmentType", "shift"];
      if (entity === "ALPHA" || entity === "BOTH") keys.push("centre");
      return keys;
    }
    case "students":
    case "marks-summary":
    case "report-card-status":
      return ["pwsClass", "sectionLetter"];
    case "players":
      return ["sport", "playerCategory", "centre", "personStatus"];
    case "attendance-summary":
    case "attendance-detail": {
      const keys: ReportFilterKey[] = ["attendanceStatus"];
      if (entity === "PWS" || entity === "BOTH") keys.push("pwsClass", "sectionLetter");
      if (entity === "ALPHA" || entity === "BOTH") keys.push("sport", "centre");
      return keys;
    }
    case "outstanding-invoices":
    case "payment-receipts":
      return ["invoiceStatus", "paymentMethod"];
    default:
      return [];
  }
}

export function resolveReportFilterFields(
  reportId: ReportId,
  entity: EntityScope,
  filters: AdvancedFilterState,
): ReportFilterField[] {
  return resolveReportFilterKeys(reportId, entity).map((key) => {
    const base = FILTER_FIELDS[key];
    if (key === "sectionLetter" && filters.pwsClass === "All") {
      return {
        key,
        ...base,
        options: [ALL_OPTION("All sections")],
      };
    }
    if (key === "feeCollectionType") {
      return { key, ...base, hint: filters.feeCollectionType === "historical_due" ? base.hint : undefined };
    }
    return { key, ...base };
  });
}

export function countActiveAdvancedFilters(
  reportId: ReportId,
  entity: EntityScope,
  filters: AdvancedFilterState,
  periodKind: string,
  customFrom: string,
  customTo: string,
): number {
  let n = 0;
  const fields = resolveReportFilterFields(reportId, entity, filters);
  for (const field of fields) {
    const value = filters[field.stateKey];
    if (field.key === "feeCollectionType" && value !== "monthly_collection") n++;
    else if (value !== "All") n++;
  }
  if (periodKind === "custom" && (customFrom || customTo)) n++;
  return n;
}

export function activeFilterChips(
  reportId: ReportId,
  entity: EntityScope,
  filters: AdvancedFilterState,
  periodKind: string,
  customFrom: string,
  customTo: string,
  periodLabel: (kind: string) => string,
): { key: string; label: string; resetKey: keyof AdvancedFilterState | "period"; resetValue?: string }[] {
  const chips: { key: string; label: string; resetKey: keyof AdvancedFilterState | "period"; resetValue?: string }[] = [];

  if (periodKind !== "this_month") {
    const periodText = periodKind === "custom"
      ? `Period: ${customFrom || "…"} – ${customTo || "…"}`
      : `Period: ${periodLabel(periodKind)}`;
    chips.push({ key: "period", label: periodText, resetKey: "period" });
  }

  for (const field of resolveReportFilterFields(reportId, entity, filters)) {
    const value = filters[field.stateKey];
    if (field.key === "feeCollectionType") {
      if (value === "monthly_collection") continue;
      const label = FEE_COLLECTION_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
      chips.push({ key: field.key, label, resetKey: "feeCollectionType", resetValue: "monthly_collection" });
      continue;
    }
    if (value === "All") continue;
    const optLabel = field.options.find((o) => o.value === value)?.label || value;
    chips.push({
      key: field.key,
      label: `${field.label}: ${optLabel}`,
      resetKey: field.stateKey,
    });
  }
  return chips;
}

export function isPwsOnlyReportBlocked(reportId: ReportId, entity: EntityScope): boolean {
  return entity === "ALPHA" && PWS_ONLY_REPORTS.has(reportId);
}

export function feeCollectionTypeLabel(value: FeeCollectionType): string {
  return FEE_COLLECTION_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
}

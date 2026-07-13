/**
 * PWS fee structure — 2026-27 (mirrors backend pws_fee_structure.py)
 */

export const PWS_ACADEMIC_YEAR = "2026-27";
export const PWS_FY_START = "2026-04";
export const PWS_FY_END = "2027-03";

export const PWS_STUDENT_TYPES = ["Day School", "Boarding", "Day Boarding"] as const;
export type PwsStudentType = typeof PWS_STUDENT_TYPES[number];

export const PWS_CLASSES = [
  "Nursery", "UKG",
  "Class I", "Class II", "Class III", "Class IV", "Class V", "Class VI",
  "Class VII", "Class VIII", "Class IX", "Class X",
] as const;
export type PwsClass = typeof PWS_CLASSES[number];

export const TRANSPORT_DISTANCES = ["Up to 5 km", "Over 5 km"] as const;
export type TransportDistance = typeof TRANSPORT_DISTANCES[number];

export const FEE_CATEGORIES = [
  "Registration",
  "Admission Charges",
  "Security (Refundable)",
  "Annual Charges",
  "Tuition",
  "Physical Education",
  "Exam Fee",
  "Transport",
] as const;

function classIdx(pwsClass: string): number {
  const i = PWS_CLASSES.indexOf(pwsClass as PwsClass);
  return i >= 0 ? i : 0;
}

function nurseryToIv(pwsClass: string): boolean {
  return classIdx(pwsClass) <= 5;
}

function nurseryToIii(pwsClass: string): boolean {
  return classIdx(pwsClass) <= 4;
}

export function tuitionAmount(pwsClass: string): number {
  const i = classIdx(pwsClass);
  if (i <= 1) return 1300;
  if (i <= 4) return 1800;
  if (i <= 7) return 2000;
  if (i <= 9) return 2300;
  return 3000;
}

export function peAmount(pwsClass: string): number {
  const i = classIdx(pwsClass);
  if (i <= 1) return 500;
  if (i <= 4) return 750;
  return 1000;
}

export function examAmount(pwsClass: string): number {
  return nurseryToIv(pwsClass) ? 1000 : 1500;
}

export function securityAmount(pwsClass: string): number {
  return nurseryToIii(pwsClass) ? 2000 : 3000;
}

export function annualAmount(pwsClass: string): number {
  return nurseryToIv(pwsClass) ? 5000 : 6000;
}

export function transportAmount(distance?: TransportDistance | null): number {
  if (distance === "Over 5 km") return 3000;
  if (distance === "Up to 5 km") return 2500;
  return 0;
}

export function resolveCategoryAmounts(
  pwsClass: string,
  transportEnabled: boolean,
  transportDistance?: TransportDistance | null,
  overrides?: Partial<Record<string, number>>,
): Record<string, number> {
  const base: Record<string, number> = {
    Registration: 1000,
    "Admission Charges": 10000,
    "Security (Refundable)": securityAmount(pwsClass),
    "Annual Charges": annualAmount(pwsClass),
    Tuition: tuitionAmount(pwsClass),
    "Physical Education": peAmount(pwsClass),
    "Exam Fee": examAmount(pwsClass),
  };
  if (transportEnabled) {
    base.Transport = transportAmount(transportDistance);
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) {
    out[k] = overrides?.[k] ?? v;
  }
  return out;
}

export function canOverridePwsFees(role?: string): boolean {
  return role === "super_admin" || role === "principal" || role === "vice_principal";
}

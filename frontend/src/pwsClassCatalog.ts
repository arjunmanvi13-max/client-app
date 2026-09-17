/**
 * Single source of truth for PWS class / standard values.
 *
 * Canonical stored + display value: Nursery, LKG, UKG, Std 1 … Std 12
 * Internal code: NURSERY, LKG, UKG, STD_01 … STD_12
 * Never display Nur, Std Nur, Class I, Class X, 10th, or Grade 10.
 */
export const CLASS_LIST = [
  "Nursery",
  "LKG",
  "UKG",
  "Std 1",
  "Std 2",
  "Std 3",
  "Std 4",
  "Std 5",
  "Std 6",
  "Std 7",
  "Std 8",
  "Std 9",
  "Std 10",
  "Std 11",
  "Std 12",
] as const;

export type PwsClassCanonical = (typeof CLASS_LIST)[number];

export const CLASS_TO_GRADE_KEY: Record<PwsClassCanonical, string> = {
  Nursery: "Nur",
  LKG: "LKG",
  UKG: "UKG",
  "Std 1": "1",
  "Std 2": "2",
  "Std 3": "3",
  "Std 4": "4",
  "Std 5": "5",
  "Std 6": "6",
  "Std 7": "7",
  "Std 8": "8",
  "Std 9": "9",
  "Std 10": "10",
  "Std 11": "11",
  "Std 12": "12",
};

export const CLASS_TO_CODE: Record<PwsClassCanonical, string> = {
  Nursery: "NURSERY",
  LKG: "LKG",
  UKG: "UKG",
  "Std 1": "STD_01",
  "Std 2": "STD_02",
  "Std 3": "STD_03",
  "Std 4": "STD_04",
  "Std 5": "STD_05",
  "Std 6": "STD_06",
  "Std 7": "STD_07",
  "Std 8": "STD_08",
  "Std 9": "STD_09",
  "Std 10": "STD_10",
  "Std 11": "STD_11",
  "Std 12": "STD_12",
};

const ROMAN_TO_ARABIC: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5",
  vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  xi: "11", xii: "12",
};
const ARABIC_TO_ROMAN: Record<string, string> = Object.fromEntries(
  Object.entries(ROMAN_TO_ARABIC).map(([r, n]) => [n, r.toUpperCase()]),
);

function fold(value: string): string {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildAliasMap(): Record<string, PwsClassCanonical> {
  const mapping: Record<string, PwsClassCanonical> = {};
  const add = (alias: string, canonical: PwsClassCanonical) => {
    const key = fold(alias);
    if (!key) return;
    mapping[key] = canonical;
    mapping[key.replace(/\s+/g, "")] = canonical;
  };
  for (const canonical of CLASS_LIST) {
    add(canonical, canonical);
    add(canonical.replace("Std ", "Class "), canonical);
    add(canonical.replace("Std ", "Standard "), canonical);
    add(canonical.replace("Std ", "Grade "), canonical);
    const key = CLASS_TO_GRADE_KEY[canonical];
    add(key, canonical);
    add(`std ${key}`, canonical);
    add(`std${key}`, canonical);
    add(`standard ${key}`, canonical);
    add(`grade ${key}`, canonical);
    add(`class ${key}`, canonical);
    add(`class-${key}`, canonical);
    add(CLASS_TO_CODE[canonical], canonical);
    if (/^\d+$/.test(key)) {
      const roman = ARABIC_TO_ROMAN[key];
      add(roman, canonical);
      add(`class ${roman}`, canonical);
      add(`std ${roman}`, canonical);
      add(`class${key}`, canonical);
      add(`c${key}`, canonical);
      add(`${key}th`, canonical);
    }
  }
  add("nur", "Nursery");
  add("std nur", "Nursery");
  add("nursary", "Nursery");
  add("pre nursery", "Nursery");
  add("kg1", "LKG");
  add("kg 1", "LKG");
  add("kg2", "UKG");
  add("kg 2", "UKG");
  return mapping;
}

const ALIAS_TO_CANONICAL = buildAliasMap();

export function normalizeClassValue(inputVal?: string | null): PwsClassCanonical | null {
  const raw = (inputVal || "").trim();
  if (!raw) return null;
  if ((CLASS_LIST as readonly string[]).includes(raw)) return raw as PwsClassCanonical;
  const folded = fold(raw);
  return ALIAS_TO_CANONICAL[folded] || ALIAS_TO_CANONICAL[folded.replace(/\s+/g, "")] || null;
}

export function formatClassDisplay(classVal?: string | null): string {
  if (!(classVal || "").trim()) return "";
  return normalizeClassValue(classVal) || (classVal || "").trim();
}

export function classCodeForClass(classVal?: string | null): string {
  const canon = normalizeClassValue(classVal);
  return canon ? CLASS_TO_CODE[canon] : "";
}

export function gradeKeyForClass(classVal?: string | null): string {
  const canon = normalizeClassValue(classVal);
  if (!canon) return (classVal || "").trim();
  return CLASS_TO_GRADE_KEY[canon];
}

export function classForGradeKey(gradeName?: string | null): PwsClassCanonical | null {
  return normalizeClassValue(gradeName);
}

export function sameClass(a?: string | null, b?: string | null): boolean {
  const left = normalizeClassValue(a);
  const right = normalizeClassValue(b);
  if (left && right) return left === right;
  return fold(a || "") === fold(b || "") && !!fold(a || "");
}

export function classAliases(classVal?: string | null): string[] {
  const canon = normalizeClassValue(classVal);
  if (!canon) {
    const raw = (classVal || "").trim();
    return raw ? [raw] : [];
  }
  const key = CLASS_TO_GRADE_KEY[canon];
  const out = new Set<string>([
    canon,
    CLASS_TO_CODE[canon],
    key,
    `Std ${key}`,
    `Grade ${key}`,
    `Class ${key}`,
    `Class-${key}`,
  ]);
  if (/^\d+$/.test(key)) {
    const roman = ARABIC_TO_ROMAN[key];
    out.add(`Class ${roman}`);
    out.add(`Std ${roman}`);
    out.add(roman);
  }
  if (canon === "Nursery") {
    out.add("Nur");
    out.add("nursery");
    out.add("Std Nur");
  }
  return [...out];
}

export const CLASS_SELECT_OPTIONS = CLASS_LIST.map((c) => ({ value: c, label: c }));

/** @deprecated Use CLASS_LIST — kept so existing imports keep working. */
export const PWS_CLASS_OPTIONS = CLASS_LIST;

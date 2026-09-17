export const PWS_CLASS_FIELDS = [
  { key: "nursery", label: "Nursery", group: "Kindergarten" },
  { key: "lkg", label: "LKG", group: "Kindergarten" },
  { key: "ukg", label: "UKG", group: "Kindergarten" },
  { key: "std1", label: "Std 1", group: "Primary & Secondary" },
  { key: "std2", label: "Std 2", group: "Primary & Secondary" },
  { key: "std3", label: "Std 3", group: "Primary & Secondary" },
  { key: "std4", label: "Std 4", group: "Primary & Secondary" },
  { key: "std5", label: "Std 5", group: "Primary & Secondary" },
  { key: "std6", label: "Std 6", group: "Primary & Secondary" },
  { key: "std7", label: "Std 7", group: "Primary & Secondary" },
  { key: "std8", label: "Std 8", group: "Primary & Secondary" },
  { key: "std9", label: "Std 9", group: "Primary & Secondary" },
  { key: "std10", label: "Std 10", group: "Primary & Secondary" },
] as const;

export type PwsClassKey = (typeof PWS_CLASS_FIELDS)[number]["key"];

export interface PwsCapacityBaseline {
  nursery: number;
  lkg: number;
  ukg: number;
  std1: number;
  std2: number;
  std3: number;
  std4: number;
  std5: number;
  std6: number;
  std7: number;
  std8: number;
  std9: number;
  std10: number;
}

export interface AlphaSportCategory {
  cricket: number;
  football: number;
}

export interface AlphaCapacityBaseline {
  dayBoarding: AlphaSportCategory;
  boarding: AlphaSportCategory;
  hostel: AlphaSportCategory;
  dailyPlayers: AlphaSportCategory;
}

export const ALPHA_CATEGORY_FIELDS = [
  { key: "dayBoarding", label: "Day Boarding" },
  { key: "boarding", label: "Boarding" },
  { key: "hostel", label: "Hostel" },
  { key: "dailyPlayers", label: "Daily Players" },
] as const;

export type AlphaCategoryKey = (typeof ALPHA_CATEGORY_FIELDS)[number]["key"];

export type AlphaSportKey = keyof AlphaSportCategory;

export const ALPHA_SPORTS: AlphaSportKey[] = ["cricket", "football"];

export function emptyPwsBaselineStrings(): Record<PwsClassKey, string> {
  return Object.fromEntries(PWS_CLASS_FIELDS.map((f) => [f.key, "0"])) as Record<PwsClassKey, string>;
}

export function emptyAlphaBaselineStrings(): Record<AlphaCategoryKey, Record<AlphaSportKey, string>> {
  return Object.fromEntries(
    ALPHA_CATEGORY_FIELDS.map((cat) => [
      cat.key,
      { cricket: "0", football: "0" },
    ]),
  ) as Record<AlphaCategoryKey, Record<AlphaSportKey, string>>;
}

export function parsePwsBaseline(form: Record<PwsClassKey, string>): PwsCapacityBaseline {
  const out = {} as PwsCapacityBaseline;
  for (const field of PWS_CLASS_FIELDS) {
    out[field.key] = parseInt(form[field.key] || "0", 10) || 0;
  }
  return out;
}

export function parseAlphaBaseline(
  form: Record<AlphaCategoryKey, Record<AlphaSportKey, string>>,
): AlphaCapacityBaseline {
  const out = {} as AlphaCapacityBaseline;
  for (const cat of ALPHA_CATEGORY_FIELDS) {
    out[cat.key] = {
      cricket: parseInt(form[cat.key].cricket || "0", 10) || 0,
      football: parseInt(form[cat.key].football || "0", 10) || 0,
    };
  }
  return out;
}

export function sumPwsBaseline(values: Record<PwsClassKey, string | number>): number {
  return PWS_CLASS_FIELDS.reduce((sum, f) => sum + (parseInt(String(values[f.key] || "0"), 10) || 0), 0);
}

export function sumAlphaBaseline(form: Record<AlphaCategoryKey, Record<AlphaSportKey, string>>): {
  cricket: number;
  football: number;
  overall: number;
} {
  let cricket = 0;
  let football = 0;
  for (const cat of ALPHA_CATEGORY_FIELDS) {
    cricket += parseInt(form[cat.key].cricket || "0", 10) || 0;
    football += parseInt(form[cat.key].football || "0", 10) || 0;
  }
  return { cricket, football, overall: cricket + football };
}

export function pwsBaselineFromApi(raw?: Record<string, number>): Record<PwsClassKey, string> {
  const next = emptyPwsBaselineStrings();
  if (!raw) return next;
  for (const field of PWS_CLASS_FIELDS) {
    next[field.key] = String(raw[field.key] ?? 0);
  }
  return next;
}

export function alphaBaselineFromApi(raw?: Record<string, Record<string, number>>): Record<AlphaCategoryKey, Record<AlphaSportKey, string>> {
  const next = emptyAlphaBaselineStrings();
  if (!raw) return next;
  for (const cat of ALPHA_CATEGORY_FIELDS) {
    const row = raw[cat.key] || {};
    next[cat.key] = {
      cricket: String(row.cricket ?? 0),
      football: String(row.football ?? 0),
    };
  }
  return next;
}

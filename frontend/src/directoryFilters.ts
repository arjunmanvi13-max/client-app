import { PWS_CLASS_OPTIONS, SECTION_LETTERS } from "./academicStructure";
import type { FormSelectOption } from "./components/forms/FormSelect";

export type OrgFilter = "all" | "PWS" | "ALPHA";
export type CategoryFilter = "all" | "Daily" | "Boarding" | "Day Boarding" | "Hostel";

export type DirectoryEntry = {
  id: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  role: string;
  organization: string;
  department?: string | null;
  pwsClass?: string | null;
  sectionLetter?: string | null;
  sport?: string | null;
  centre?: string | null;
  category?: string | null;
  skillLevel?: string | null;
  status?: string | null;
  playerId?: string | null;
  source: "user" | "person";
};

export type DirectoryFilterState = {
  org: OrgFilter;
  pwsClass: string;
  pwsSection: string;
  alphaSport: string;
  alphaVenue: string;
  alphaSkill: string;
  category: CategoryFilter;
};

export const ORG_FILTER_OPTIONS: FormSelectOption[] = [
  { value: "all", label: "All" },
  { value: "PWS", label: "PWS" },
  { value: "ALPHA", label: "ALPHA" },
];

export const CATEGORY_FILTER_OPTIONS: FormSelectOption[] = [
  { value: "all", label: "All Categories" },
  { value: "Daily", label: "Daily" },
  { value: "Boarding", label: "Boarding" },
  { value: "Day Boarding", label: "Day Boarding" },
  { value: "Hostel", label: "Hostel" },
];

export const PWS_CLASS_FILTER_OPTIONS: FormSelectOption[] = [
  { value: "", label: "All classes" },
  ...PWS_CLASS_OPTIONS.map((c) => ({ value: c, label: c })),
];

export const PWS_SECTION_FILTER_OPTIONS: FormSelectOption[] = [
  { value: "", label: "All sections" },
  ...SECTION_LETTERS.map((l) => ({ value: l, label: l })),
];

export const ALPHA_SPORT_FILTER_OPTIONS: FormSelectOption[] = [
  { value: "", label: "All sports" },
  { value: "Cricket", label: "Cricket" },
  { value: "Football", label: "Football" },
];

export const ALPHA_VENUE_FILTER_OPTIONS: FormSelectOption[] = [
  { value: "", label: "All venues" },
  { value: "Balua", label: "Balua" },
  { value: "Harding Park", label: "Harding Park" },
  { value: "Defense Colony", label: "Defense Colony" },
];

export const ALPHA_SKILL_FILTER_OPTIONS: FormSelectOption[] = [
  { value: "", label: "All skill levels" },
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

function parseSectionLetter(group?: string | null): string | null {
  const m = (group || "").trim().match(/-([A-F])$/i);
  return m ? m[1].toUpperCase() : null;
}

export function normalizeEnrollmentCategory(raw?: string | null): CategoryFilter | null {
  if (!raw) return null;
  if (raw === "Day School") return "Daily";
  if (raw === "Hostel Only" || raw === "Hostel") return "Hostel";
  if (raw === "Daily" || raw === "Boarding" || raw === "Day Boarding") return raw;
  return null;
}

export function userToDirectoryEntry(u: Record<string, unknown>): DirectoryEntry {
  return {
    id: String(u.id),
    name: String(u.name || ""),
    email: (u.email as string) || null,
    mobile: (u.mobile as string) || (u.phone as string) || null,
    role: String(u.role || "user"),
    organization: String(u.organization || "PWS"),
    department: (u.department as string) || null,
    category: null,
    status: (u.status as string) || (u.is_active === false ? "deactivated" : "active"),
    source: "user",
  };
}

export function personToDirectoryEntry(p: Record<string, unknown>): DirectoryEntry {
  const kind = String(p.kind || "person");
  const categoryRaw = kind === "student"
    ? (p.pws_student_type as string)
    : (p.player_type as string);
  const group = (p.group as string) || null;
  const subtitle = kind === "student"
    ? group || (p.pws_class as string) || undefined
    : [p.sport, p.centre, group].filter(Boolean).join(" · ") || undefined;

  return {
    id: String(p.id),
    name: String(p.name || ""),
    email: (p.email as string) || null,
    mobile: (p.mobile as string) || (p.guardian_phone as string) || null,
    role: kind,
    organization: String(p.organization || (kind === "player" ? "ALPHA" : "PWS")),
    department: subtitle || null,
    pwsClass: (p.pws_class as string) || null,
    sectionLetter: parseSectionLetter(group),
    sport: (p.sport as string) || null,
    centre: (p.centre as string) || null,
    category: categoryRaw || null,
    skillLevel: (p.skill_level as string) || null,
    status: (p.status as string) || "active",
    playerId: (p.player_id as string) || (p.admission_number as string) || null,
    source: "person",
  };
}

export function unwrapPeoplePayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown[] }).data)) {
    return (data as { data: Record<string, unknown>[] }).data;
  }
  return [];
}

function matchesOrg(entry: DirectoryEntry, org: OrgFilter): boolean {
  if (org === "all") return true;
  if (entry.organization === org) return true;
  if (entry.organization === "BOTH") return true;
  return false;
}

export function filterDirectoryEntries(
  entries: DirectoryEntry[],
  filters: DirectoryFilterState,
  search: string,
): DirectoryEntry[] {
  let list = entries.filter((e) => matchesOrg(e, filters.org));

  if (filters.org === "PWS") {
    if (filters.pwsClass) {
      list = list.filter((e) => e.pwsClass === filters.pwsClass);
    }
    if (filters.pwsSection) {
      list = list.filter((e) => e.sectionLetter === filters.pwsSection);
    }
  }

  if (filters.org === "ALPHA") {
    if (filters.alphaSport) {
      list = list.filter((e) => e.sport === filters.alphaSport);
    }
    if (filters.alphaVenue) {
      list = list.filter((e) => e.centre === filters.alphaVenue);
    }
    if (filters.alphaSkill) {
      list = list.filter((e) => e.skillLevel === filters.alphaSkill);
    }
  }

  if (filters.category !== "all") {
    list = list.filter((e) => normalizeEnrollmentCategory(e.category) === filters.category);
  }

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter((e) =>
      (e.name || "").toLowerCase().includes(q)
      || (e.email || "").toLowerCase().includes(q)
      || (e.department || "").toLowerCase().includes(q)
      || (e.role || "").toLowerCase().includes(q)
      || (e.centre || "").toLowerCase().includes(q)
      || (e.sport || "").toLowerCase().includes(q)
      || (e.skillLevel || "").toLowerCase().includes(q)
      || (e.mobile || "").toLowerCase().includes(q),
    );
  }

  return list;
}

export function clearedSubFiltersForOrg(org: OrgFilter): Pick<DirectoryFilterState, "pwsClass" | "pwsSection" | "alphaSport" | "alphaVenue" | "alphaSkill"> {
  return { pwsClass: "", pwsSection: "", alphaSport: "", alphaVenue: "", alphaSkill: "" };
}

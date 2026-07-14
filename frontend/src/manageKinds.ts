/**
 * Roster / legacy manage routes under /manage/[kind].
 * Login user types (pws_admin, alpha_coach, …) are handled separately via userClassification.
 */

export const PEOPLE_KINDS = ["student", "player", "staff"] as const;
export type PeopleKind = (typeof PEOPLE_KINDS)[number];

export const LEGACY_USER_KINDS = ["coach", "teacher", "admin", "parent"] as const;

export type ManageListMeta = {
  label: string;
  tint: string;
  isUser: boolean;
  subtitle: (row: any) => string;
};

export const MANAGE_LIST_META: Record<string, ManageListMeta> = {
  admin: {
    label: "Sports Admins",
    tint: "#7C3AED",
    isUser: true,
    subtitle: (u) => `${u.email || u.mobile || ""} · ${u.organization || "ALPHA"}`,
  },
  coach: {
    label: "Coaches",
    tint: "#EA580C",
    isUser: true,
    subtitle: (u) => `${u.email} · ${u.department || u.organization}`,
  },
  teacher: {
    label: "Teachers",
    tint: "#1E40AF",
    isUser: true,
    subtitle: (u) => `${u.email} · ${u.department || u.organization}`,
  },
  parent: {
    label: "Parents / Guardians",
    tint: "#0891B2",
    isUser: true,
    subtitle: (u) => `${u.email || u.mobile || ""} · ${u.organization || "PWS"}`,
  },
  player: {
    label: "Players",
    tint: "#16A34A",
    isUser: false,
    subtitle: (p) =>
      `${p.player_id || ""}${p.player_id ? " · " : ""}${p.group || ""}${p.sport ? " · " + p.sport : ""}${p.centre ? " · " + p.centre : ""}`,
  },
  student: {
    label: "Students",
    tint: "#2563EB",
    isUser: false,
    subtitle: (p) =>
      `${p.admission_number || ""}${p.admission_number ? " · " : ""}${p.group || ""}${p.roll_number ? " · Roll " + p.roll_number : ""}`,
  },
  staff: {
    label: "Staff",
    tint: "#0EA5E9",
    isUser: false,
    subtitle: (p) =>
      `${p.employee_id || ""}${p.employee_id ? " · " : ""}${p.group || p.department || "Staff"} · ${p.organization}${p.centre ? " · " + p.centre : ""}`,
  },
};

export function isPeopleKind(kind: string): kind is PeopleKind {
  return (PEOPLE_KINDS as readonly string[]).includes(kind);
}

export function getManageListMeta(kind: string): ManageListMeta | null {
  return MANAGE_LIST_META[kind] || null;
}

export function rosterLabel(kind: string): string {
  return MANAGE_LIST_META[kind]?.label || kind;
}

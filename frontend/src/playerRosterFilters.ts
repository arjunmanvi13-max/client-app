export const PLAYER_SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export const PLAYER_SPORTS = ["Cricket", "Football"] as const;
export const PLAYER_CENTRES = ["Balua", "Harding Park", "Defense Colony"] as const;
export const PLAYER_TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"] as const;

export type PlayerRosterFacets = {
  sports: string[];
  types: string[];
  centres: string[];
  skills: string[];
};

export function normalizePlayerType(raw?: string | null): string {
  if (!raw) return "";
  if (raw === "Hostel Only") return "Hostel";
  return raw;
}

export function toggleFilterValue(current: string[], value: string): string[] {
  if (!value) return current;
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function playerMatchesFacets(player: Record<string, unknown>, facets: PlayerRosterFacets): boolean {
  if (facets.sports.length && !facets.sports.includes(String(player.sport || ""))) return false;
  if (facets.centres.length && !facets.centres.includes(String(player.centre || ""))) return false;
  if (facets.skills.length && !facets.skills.includes(String(player.skill_level || ""))) return false;
  if (facets.types.length) {
    const type = normalizePlayerType(player.player_type as string);
    if (!facets.types.includes(type) && !facets.types.includes(String(player.player_type || ""))) {
      return false;
    }
  }
  return true;
}

export function filterPlayersByFacets<T extends Record<string, unknown>>(
  items: T[],
  facets: PlayerRosterFacets,
): T[] {
  if (!facets.sports.length && !facets.types.length && !facets.centres.length && !facets.skills.length) {
    return items;
  }
  return items.filter((item) => playerMatchesFacets(item, facets));
}

export function activeFacetCount(facets: PlayerRosterFacets): number {
  return facets.sports.length + facets.types.length + facets.centres.length + facets.skills.length;
}

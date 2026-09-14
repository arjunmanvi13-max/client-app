import type { CollectionPlayer, FeeSort, FeeStatusFilter } from "./feesCollectionTypes";

export const ALPHA_PLAYER_TYPES = ["Daily", "Hostel Only", "Day Boarding", "Boarding"] as const;
export type AlphaPlayerType = (typeof ALPHA_PLAYER_TYPES)[number];

export function canonicalPlayerType(value?: string | null): string {
  const raw = (value || "").trim();
  if (raw === "Hostel") return "Hostel Only";
  return raw;
}

export function filterPlayersByPlayerTypes(
  players: CollectionPlayer[],
  types: string[],
): CollectionPlayer[] {
  if (!types.length || types.length >= ALPHA_PLAYER_TYPES.length) return players;
  const selected = new Set(types.map(canonicalPlayerType));
  return players.filter((p) => selected.has(canonicalPlayerType(p.player_type)));
}

export function filterPlayersByStatus(
  players: CollectionPlayer[],
  status: FeeStatusFilter,
): CollectionPlayer[] {
  switch (status) {
    case "overdue":
      return players.filter((p) => p.fee_status === "overdue");
    case "due_this_month":
      return players.filter((p) => p.has_current_month_due && p.amount_due > 0);
    case "paid_ahead":
      return players.filter((p) => p.fee_status === "paid_ahead");
    case "all":
    default:
      return players;
  }
}

export function sortCollectionPlayers(
  players: CollectionPlayer[],
  sort: FeeSort,
): CollectionPlayer[] {
  const rows = [...players];
  switch (sort) {
    case "name":
      return rows.sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
      );
    case "amount_due_asc":
      return rows.sort((a, b) => (a.amount_due || 0) - (b.amount_due || 0));
    case "overdue_days":
      return rows.sort((a, b) => (b.overdue_days || 0) - (a.overdue_days || 0));
    case "amount_due":
    default:
      return rows.sort((a, b) => (b.amount_due || 0) - (a.amount_due || 0));
  }
}

export function applyCollectionFilters(
  players: CollectionPlayer[],
  status: FeeStatusFilter,
  sort: FeeSort,
  playerTypes: string[] = [],
): CollectionPlayer[] {
  return sortCollectionPlayers(
    filterPlayersByStatus(filterPlayersByPlayerTypes(players, playerTypes), status),
    sort,
  );
}

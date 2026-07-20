import type { CollectionPlayer, FeeSort, FeeStatusFilter } from "./feesCollectionTypes";

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
): CollectionPlayer[] {
  return sortCollectionPlayers(filterPlayersByStatus(players, status), sort);
}

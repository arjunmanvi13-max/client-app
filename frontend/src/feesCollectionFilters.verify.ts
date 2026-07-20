import assert from "node:assert/strict";
import { applyCollectionFilters, filterPlayersByStatus, sortCollectionPlayers } from "./feesCollectionFilters";
import type { CollectionPlayer } from "./feesCollectionTypes";

const sample: CollectionPlayer[] = [
  {
    id: "1",
    name: "Dhairy kumar",
    amount_due: 5000,
    amount_due_today: 5000,
    overdue_days: 10,
    fee_status: "overdue",
    badge: "Overdue 10d",
    has_current_month_due: true,
  },
  {
    id: "2",
    name: "Aarav kumar",
    amount_due: 89000,
    amount_due_today: 89000,
    overdue_days: 106,
    fee_status: "overdue",
    badge: "Overdue 106d",
    has_current_month_due: true,
  },
  {
    id: "3",
    name: "Zara",
    amount_due: 0,
    amount_due_today: 0,
    overdue_days: 0,
    fee_status: "paid_ahead",
    badge: "Paid Ahead",
    has_current_month_due: false,
  },
];

assert.deepEqual(
  filterPlayersByStatus(sample, "overdue").map((p) => p.id),
  ["1", "2"],
);
assert.deepEqual(
  filterPlayersByStatus(sample, "paid_ahead").map((p) => p.id),
  ["3"],
);
assert.deepEqual(
  sortCollectionPlayers(sample, "name").map((p) => p.name),
  ["Aarav kumar", "Dhairy kumar", "Zara"],
);
assert.deepEqual(
  sortCollectionPlayers(sample, "amount_due").map((p) => p.id),
  ["2", "1", "3"],
);
assert.deepEqual(
  sortCollectionPlayers(sample, "amount_due_asc").map((p) => p.id),
  ["3", "1", "2"],
);

const filtered = applyCollectionFilters(sample, "overdue", "name");
assert.deepEqual(filtered.map((p) => p.name), ["Aarav kumar", "Dhairy kumar"]);

console.log("feesCollectionFilters.verify.ts OK");

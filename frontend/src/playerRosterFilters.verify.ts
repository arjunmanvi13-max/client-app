import assert from "node:assert/strict";
import {
  activeFacetCount,
  filterPlayersByFacets,
  playerMatchesFacets,
  toggleFilterValue,
} from "./playerRosterFilters";

const players = [
  { id: "1", sport: "Cricket", centre: "Balua", player_type: "Daily", skill_level: "Beginner" },
  { id: "2", sport: "Football", centre: "Defense Colony", player_type: "Hostel Only", skill_level: "Advanced" },
  { id: "3", sport: "Cricket", centre: "Defense Colony", player_type: "Daily", skill_level: "Advanced" },
];

assert.deepEqual(toggleFilterValue([], "Balua"), ["Balua"]);
assert.deepEqual(toggleFilterValue(["Balua"], "Balua"), []);
assert.deepEqual(toggleFilterValue(["Balua"], "Defense Colony"), ["Balua", "Defense Colony"]);

assert.equal(
  playerMatchesFacets(players[1], { sports: [], types: ["Hostel"], centres: [], skills: [] }),
  true,
);

assert.deepEqual(
  filterPlayersByFacets(players, {
    sports: ["Cricket"],
    types: [],
    centres: ["Defense Colony"],
    skills: ["Advanced"],
  }).map((p) => p.id),
  ["3"],
);

assert.equal(activeFacetCount({ sports: ["Cricket"], types: [], centres: ["Balua", "Defense Colony"], skills: [] }), 3);

console.log("playerRosterFilters.verify.ts OK");

import assert from "node:assert/strict";
import {
  filterDirectoryEntries,
  normalizeEnrollmentCategory,
  personToDirectoryEntry,
  userToDirectoryEntry,
} from "./directoryFilters";

const sample = [
  userToDirectoryEntry({ id: "u1", name: "Principal", role: "principal", organization: "PWS" }),
  personToDirectoryEntry({
    id: "s1",
    name: "Riya",
    kind: "student",
    organization: "PWS",
    pws_class: "Class IX",
    group: "9-A",
    pws_student_type: "Boarding",
  }),
  personToDirectoryEntry({
    id: "p1",
    name: "Arjun",
    kind: "player",
    organization: "ALPHA",
    sport: "Cricket",
    centre: "Balua",
    player_type: "Daily",
  }),
];

assert.deepEqual(
  filterDirectoryEntries(
    sample,
    {
      org: "PWS",
      pwsClass: "Class IX",
      pwsSection: "A",
      alphaSport: "",
      alphaVenue: "",
      alphaSkill: "",
      category: "Boarding",
    },
    "",
  ).map((r) => r.id),
  ["s1"],
);

assert.deepEqual(
  filterDirectoryEntries(
    sample,
    {
      org: "ALPHA",
      pwsClass: "",
      pwsSection: "",
      alphaSport: "Cricket",
      alphaVenue: "Balua",
      alphaSkill: "",
      category: "all",
    },
    "",
  ).map((r) => r.id),
  ["p1"],
);

assert.equal(normalizeEnrollmentCategory("Hostel Only"), "Hostel");
assert.equal(normalizeEnrollmentCategory("Day School"), "Daily");

console.log("directoryFilters.verify.ts OK");

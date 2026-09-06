import assert from "node:assert/strict";
import { reportExportFilename } from "./reportExportFilename";

const asOf = new Date("2026-09-06T10:00:00");

assert.equal(
  reportExportFilename("players", { entity: "alpha" }, "pdf", asOf),
  "Players_2026-09-06.pdf",
);

assert.equal(
  reportExportFilename(
    "players",
    { entity: "alpha", centre: "Harding Park", sport: "Cricket" },
    "pdf",
    asOf,
  ),
  "Players_2026-09-06_Centre-Harding-Park_Sport-Cricket.pdf",
);

assert.equal(
  reportExportFilename(
    "students",
    { status: "active", grade: "Class IX" },
    "xlsx",
    asOf,
  ),
  "Students_2026-09-06_Grade-Class-IX_Status-active.xlsx",
);

console.log("reportExportFilename.verify.ts OK");

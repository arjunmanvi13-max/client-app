/** Unit checks for category permission preview helpers. */
import { enabledModuleLabels } from "./categoryPermissionsUtil";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const catalog = [
  {
    id: "management",
    label: "Management",
    modules: [
      { id: "dashboard", label: "Dashboard" },
      {
        id: "directory",
        label: "Directory",
        children: [
          { id: "staff", label: "Staff" },
          { id: "students", label: "Students" },
        ],
      },
    ],
  },
];

assert(
  enabledModuleLabels(catalog, { dashboard: true, staff: false, students: true }).join(",") === "Dashboard,Students",
  "Enabled leaf labels only",
);

console.log("categoryPermissionsUtil.verify.ts: all checks passed");

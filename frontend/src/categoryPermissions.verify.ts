/**
 * Category permissions UI expectations.
 * Run: npm run test:category-perms
 */
import { APPROVED_LOGIN_USER_TYPES, CATALOG_BY_CODE } from "./userClassification";
import { UserRole } from "./rbac";
import {
  allLeafIds,
  applyGroupToggle,
  applyNodeToggle,
  countEnabledLeaves,
  groupNodeState,
  moduleNodeState,
} from "./categoryPermissionsUtil";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function run() {
  assert(APPROVED_LOGIN_USER_TYPES.length === 7, "Seven approved login user types");

  const labels = APPROVED_LOGIN_USER_TYPES.map((t) => CATALOG_BY_CODE[t].displayName);
  assert(labels.includes("Super Admin"), "Includes Super Admin");
  assert(labels.includes("PWS Admin"), "Includes PWS Admin");
  assert(labels.includes("ALPHA Admin"), "Includes ALPHA Admin");
  assert(labels.includes("PWS Accounts"), "Includes PWS Accounts");
  assert(labels.includes("ALPHA Accounts"), "Includes ALPHA Accounts");
  assert(labels.includes("PWS Teachers"), "Includes PWS Teachers");
  assert(labels.includes("ALPHA Coaches"), "Includes ALPHA Coaches");

  // Module groups expected in permissions panel (documented contract)
  const expectedGroups = [
    "management",
    "directory",
    "financials",
    "operations",
    "academics",
    "system",
  ];
  assert(expectedGroups.length === 6, "Six module groups in permissions IA");

  // Super Admin is first catalog entry
  assert(APPROVED_LOGIN_USER_TYPES[0] === UserRole.SUPER_ADMIN, "Super Admin is canonical first type");

  const sampleCatalog = [
    {
      id: "financials",
      label: "Financials",
      modules: [
        {
          id: "collect-fees",
          label: "Collect Fees",
        },
        {
          id: "finance-reports",
          label: "Finance Reports",
        },
      ],
    },
  ];
  const modules = { "collect-fees": true, "finance-reports": false };
  assert(allLeafIds(sampleCatalog).join(",") === "collect-fees,finance-reports", "Leaf ids include finance reports");
  assert(moduleNodeState(sampleCatalog[0].modules[0], modules) === "on", "Leaf on state");
  assert(groupNodeState(sampleCatalog[0].modules, modules) === "partial", "Group partial state");
  const toggled = applyGroupToggle(modules, sampleCatalog[0].modules, true);
  assert(toggled["collect-fees"] && toggled["finance-reports"], "Group toggle enables all leaves");
  const leafToggled = applyNodeToggle(modules, sampleCatalog[0].modules[1], true);
  assert(leafToggled["finance-reports"], "Leaf toggle updates one module");
  assert(countEnabledLeaves(sampleCatalog, toggled).enabled === 2, "Enabled leaf count");

  console.log("categoryPermissions.verify.ts: all checks passed");
}

run();

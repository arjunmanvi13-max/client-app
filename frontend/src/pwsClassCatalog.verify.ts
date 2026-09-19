import assert from "node:assert/strict";
import {
  CLASS_LIST,
  classAliases,
  formatClassDisplay,
  normalizeClassValue,
  sameClass,
} from "./pwsClassCatalog";

{
  const cases: [string, string][] = [
    ["Class I", "Std 1"],
    ["Class X", "Std 10"],
    ["Nur", "Nursery"],
    ["nur", "Nursery"],
    ["NURSERY", "Nursery"],
    ["lkg", "LKG"],
    ["ukg", "UKG"],
    ["STD_07", "Std 7"],
    ["Std III", "Std 3"],
    ["iii", "Std 3"],
    ["Class-III", "Std 3"],
    ["Standard 3", "Std 3"],
    ["grade 3", "Std 3"],
    ["1st", "Std 1"],
    ["10th", "Std 10"],
    ["C3", "Std 3"],
    ["x", "Std 10"],
  ];
  for (const [stored, expected] of cases) {
    assert.equal(normalizeClassValue(stored), expected, `${stored} should normalize to ${expected}`);
  }
}

{
  assert.equal(normalizeClassValue("Play Group"), null);
  assert.equal(normalizeClassValue(""), null);
  assert.equal(normalizeClassValue(null), null);
}

{
  assert.equal(formatClassDisplay("Class IX"), "Std 9");
  assert.equal(formatClassDisplay("Play Group"), "Play Group", "unknown labels render as themselves");
}

{
  assert.ok(sameClass("Class IX", "Std 9"));
  assert.ok(!sameClass("Class IX", "Std 10"));
}

{
  for (const canon of CLASS_LIST) {
    const aliases = classAliases(canon);
    assert.ok(aliases.includes(canon), `${canon} must include itself`);
    for (const alias of aliases) {
      assert.equal(
        normalizeClassValue(alias),
        canon,
        `alias ${alias} of ${canon} must normalize back to it`,
      );
    }
  }
}

{
  const nine = classAliases("Std 9");
  for (const stored of ["9-A".split("-")[0], "Class IX", "STD_09", "9"]) {
    assert.ok(nine.includes(stored), `roster lookup for Std 9 must include ${stored}`);
  }
}

console.log("pwsClassCatalog.verify.ts OK");

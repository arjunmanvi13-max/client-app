import {
  filterDirectoryEntries,
  normalizeEnrollmentCategory,
  personToDirectoryEntry,
  userToDirectoryEntry,
} from "./directoryFilters";

describe("directoryFilters", () => {
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

  it("filters PWS class, section, and category together", () => {
    const result = filterDirectoryEntries(
      sample,
      {
        org: "PWS",
        pwsClass: "Class IX",
        pwsSection: "A",
        alphaSport: "",
        alphaVenue: "",
        category: "Boarding",
      },
      "",
    );
    expect(result.map((r) => r.id)).toEqual(["s1"]);
  });

  it("filters ALPHA sport and venue together", () => {
    const result = filterDirectoryEntries(
      sample,
      {
        org: "ALPHA",
        pwsClass: "",
        pwsSection: "",
        alphaSport: "Cricket",
        alphaVenue: "Balua",
        category: "all",
      },
      "",
    );
    expect(result.map((r) => r.id)).toEqual(["p1"]);
  });

  it("maps hostel and day school categories", () => {
    expect(normalizeEnrollmentCategory("Hostel Only")).toBe("Hostel");
    expect(normalizeEnrollmentCategory("Day School")).toBe("Daily");
  });
});

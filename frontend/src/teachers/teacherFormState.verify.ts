import assert from "node:assert/strict";
import {
  buildTeacherFormSnapshot,
  isTeacherFormDirty,
  type TeacherFormSnapshot,
} from "./teacherFormState";

const base: TeacherFormSnapshot = {
  name: "Local Teacher",
  dateOfJoining: "01/01/2024",
  mobile: "+91 98765 43210",
  address: "Patna",
  email: "localteach@prarambhika.com",
  password: "",
  teacherDesignation: "TEACHER",
  attendanceAllowed: true,
  marksEntry: false,
  studentAssessment: false,
  classRows: [{
    key: "a",
    className: "Class I",
    sectionLetter: "A",
    subjects: ["English"],
  }],
};

const snapshot = buildTeacherFormSnapshot(base);
assert.equal(isTeacherFormDirty(snapshot, base), false);
assert.equal(
  isTeacherFormDirty(snapshot, { ...base, classRows: [{ ...base.classRows[0], subjects: ["Maths"] }] }),
  true,
);
assert.equal(isTeacherFormDirty(snapshot, { ...base, name: "Changed" }), true);

console.log("teacherFormState.verify.ts OK");

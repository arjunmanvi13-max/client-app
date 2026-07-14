import { RosterManageList } from "../../../src/RosterManageList";

/** Explicit route for Directory → Students (roster records, not login accounts). */
export default function StudentsRosterList() {
  return <RosterManageList kind="student" />;
}

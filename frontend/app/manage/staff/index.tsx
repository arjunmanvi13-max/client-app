import { RosterManageList } from "../../../src/RosterManageList";

/** Explicit route for Directory → Staff (roster records). */
export default function StaffRosterList() {
  return <RosterManageList kind="staff" />;
}

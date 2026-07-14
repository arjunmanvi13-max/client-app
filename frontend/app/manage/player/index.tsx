import { RosterManageList } from "../../../src/RosterManageList";

/** Explicit route for Directory → Players (roster records, not login accounts). */
export default function PlayersRosterList() {
  return <RosterManageList kind="player" />;
}

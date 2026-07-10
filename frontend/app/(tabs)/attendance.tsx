import { useAuth } from "../../src/auth";
import CoachAttendance from "../../src/CoachAttendance";
import GenericAttendance from "../../src/GenericAttendance";

export default function Attendance() {
  const { user } = useAuth();
  if (user?.role === "coach") return <CoachAttendance />;
  return <GenericAttendance />;
}

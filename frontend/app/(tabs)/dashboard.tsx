import { useAuth } from "../../src/auth";
import GenericDashboard from "../../src/GenericDashboard";
import CoachHome from "../../src/CoachHome";
import TeacherHome from "../../src/TeacherHome";
import SuperAdminDashboard from "../../src/SuperAdminDashboard";

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <SuperAdminDashboard />;
  if (user?.role === "admin") return <SuperAdminDashboard />;
  if (user?.role === "coach") return <CoachHome />;
  if (user?.role === "teacher") return <TeacherHome />;
  return <GenericDashboard />;
}

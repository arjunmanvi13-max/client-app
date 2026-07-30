import { useAuth } from "../../src/auth";
import GenericDashboard from "../../src/GenericDashboard";
import CoachHome from "../../src/CoachHome";
import TeacherHome from "../../src/TeacherHome";
import SuperAdminDashboard from "../../src/SuperAdminDashboard";

const PWS_DASHBOARD_ROLES = new Set(["pws_admin", "principal", "vice_principal"]);

export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "super_admin") return <SuperAdminDashboard />;
  if (user?.role === "admin") return <SuperAdminDashboard lockedEntity="alpha" />;
  if (user?.role && PWS_DASHBOARD_ROLES.has(user.role)) return <SuperAdminDashboard lockedEntity="pws" />;
  if (user?.role === "coach") return <CoachHome />;
  if (user?.role === "teacher") return <TeacherHome />;
  return <GenericDashboard />;
}

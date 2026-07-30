import { useAuth } from "../../src/auth";
import GenericDashboard from "../../src/GenericDashboard";
import CoachHome from "../../src/CoachHome";
import TeacherHome from "../../src/TeacherHome";
import SuperAdminDashboard from "../../src/SuperAdminDashboard";
import { resolveDashboardView } from "../../src/dashboardRouting";

export default function Dashboard() {
  const { user } = useAuth();
  const view = resolveDashboardView(user?.role);

  switch (view.kind) {
    case "super_admin":
      return <SuperAdminDashboard />;
    case "org_bento":
      return <SuperAdminDashboard lockedEntity={view.lockedEntity} />;
    case "teacher":
      return <TeacherHome />;
    case "coach":
      return <CoachHome />;
    default:
      return <GenericDashboard />;
  }
}

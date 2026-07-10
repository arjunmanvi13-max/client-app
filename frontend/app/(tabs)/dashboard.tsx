import { useAuth } from "../../src/auth";
import GenericDashboard from "../../src/GenericDashboard";
import CoachHome from "../../src/CoachHome";
import CommandCenter from "../../src/CommandCenter";
import { AlphaERPDashboard } from "../../src/AlphaERPDashboard";
import { useBreakpoint } from "../../src/useBreakpoint";

export default function Dashboard() {
  const { user } = useAuth();
  const { isDesktop } = useBreakpoint();
  // Modern ERP-style ALPHA dashboard for admin / super-admin on desktop.
  if ((user?.role === "super_admin" || user?.role === "admin") && isDesktop) return <AlphaERPDashboard />;
  if (user?.role === "super_admin" || user?.role === "admin") return <CommandCenter />;
  if (user?.role === "coach") return <CoachHome />;
  return <GenericDashboard />;
}

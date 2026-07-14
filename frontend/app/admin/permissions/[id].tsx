import { Redirect } from "expo-router";

/** Per-user permission editing removed — category permissions are configured on the index screen. */
export default function PermissionsUserRedirect() {
  return <Redirect href="/admin/permissions" />;
}

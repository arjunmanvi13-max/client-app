/** Shared login/roster active status — mirrors backend `status: active | deactivated`. */

export type UserStatusRecord = {
  status?: string;
  is_active?: boolean;
};

export function isActiveUser(record: UserStatusRecord | null | undefined): boolean {
  if (!record) return false;
  return record.status !== "deactivated" && record.is_active !== false;
}

export function inactiveUserSuffix(record: UserStatusRecord | null | undefined): string {
  return isActiveUser(record) ? "" : " (Inactive)";
}

export function filterActiveUsers<T extends UserStatusRecord>(rows: T[]): T[] {
  return rows.filter(isActiveUser);
}

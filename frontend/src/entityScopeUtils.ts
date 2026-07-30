import { BusinessEntity, Permission, hasPermission, isSuperAdminUser, normalizeRole, UserRole, type RBACUser } from "./rbac";

export type EntityId = "pws" | "alpha";
export type EntityScope = EntityId | "both";
export type AssignedEntity = "PWS" | "ALPHA" | "ALL";

export function toEntityId(raw: string | null | undefined): EntityId | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "pws") return "pws";
  if (v === "alpha") return "alpha";
  return null;
}

export function toEntityCode(id: EntityId): "PWS" | "ALPHA" {
  return id === "pws" ? "PWS" : "ALPHA";
}

export function toInstitution(id: EntityId): "PWS" | "ALPHA" {
  return toEntityCode(id);
}

export function entityIdFromOrg(org: string | undefined): EntityId | null {
  const u = (org || "").toUpperCase();
  if (u === "PWS") return "pws";
  if (u === "ALPHA") return "alpha";
  return null;
}

/** Authoritative assigned scope from session — ignores client overrides. */
export function assignedEntityScope(user: RBACUser | null | undefined): EntityScope {
  if (!user) return "pws";
  if (isSuperAdminUser(user)) return "both";
  const entityScope = (user as RBACUser & { entity_scope?: string }).entity_scope;
  const org = (entityScope || user.organization || "PWS").toString().toUpperCase();
  if (org === "BOTH") return "both";
  if (org === "ALPHA") return "alpha";
  const role = normalizeRole(user.role);
  if ([UserRole.PWS_ADMIN, UserRole.PWS_ACCOUNTS, UserRole.PWS_TEACHER].includes(role)) return "pws";
  if ([UserRole.ALPHA_ADMIN, UserRole.ALPHA_ACCOUNTS, UserRole.ALPHA_COACH].includes(role)) return "alpha";
  return entityIdFromOrg(org) || "pws";
}

export function assignedEntityLabel(user: RBACUser | null | undefined): AssignedEntity {
  const scope = assignedEntityScope(user);
  if (scope === "both") return "ALL";
  return scope === "pws" ? "PWS" : "ALPHA";
}

export function isMultiEntityUser(user: RBACUser | null | undefined): boolean {
  return assignedEntityScope(user) === "both";
}

export function entitiesForPermissions(
  user: RBACUser | null | undefined,
  permissions: Permission[],
): EntityId[] {
  if (!user) return [];
  const out: EntityId[] = [];
  for (const e of ["pws", "alpha"] as EntityId[]) {
    const be = e === "pws" ? BusinessEntity.PWS : BusinessEntity.ALPHA;
    if (permissions.some((p) => hasPermission(user, p, be))) out.push(e);
  }
  return out;
}

export function assertEntityAllowed(user: RBACUser | null | undefined, entity: EntityId): boolean {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  const scope = assignedEntityScope(user);
  if (scope === "both") return true;
  return scope === entity;
}

export function entityScopeLabel(scope: EntityScope): string {
  if (scope === "both") return "PWS & ALPHA";
  return scope === "pws" ? "PWS" : "ALPHA";
}

export function restrictedEntityHint(entity: EntityId): string {
  return `Restricted to ${entity.toUpperCase()}`;
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "./auth";
import { Permission } from "./rbac";
import {
  assignedEntityLabel,
  assignedEntityScope,
  assertEntityAllowed,
  entitiesForPermissions,
  isMultiEntityUser,
  toEntityCode,
  toEntityId,
  type AssignedEntity,
  type EntityId,
  type EntityScope,
} from "./entityScopeUtils";

export type UseEntityScopeOptions = {
  /** Lock UI to one entity (route-scoped pages). */
  locked?: EntityId;
  /** Allow combined/both scope for super-admin style views. */
  allowBoth?: boolean;
  /** Sync active entity with ?entity= URL param. */
  syncUrl?: boolean;
  /** Permissions that determine which entities appear in the toggle. */
  permissions?: Permission[];
  /** Initial entity when not restricted (e.g. route prop). */
  defaultEntity?: EntityId;
};

export type EntityScopeResult = {
  entity: EntityId;
  scope: EntityScope;
  entityCode: "PWS" | "ALPHA";
  institution: "PWS" | "ALPHA";
  assignedEntity: AssignedEntity;
  assignedScope: EntityScope;
  availableEntities: EntityId[];
  canSwitch: boolean;
  isRestricted: boolean;
  setEntity: (next: EntityId) => void;
  assertSubmitAllowed: (entity: EntityId) => boolean;
  apiEntityParam: EntityId;
};

export function useEntityScope(options: UseEntityScopeOptions = {}): EntityScopeResult {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ entity?: string | string[] }>();
  const urlEntity = toEntityId(Array.isArray(params.entity) ? params.entity[0] : params.entity);

  const assignedScope = assignedEntityScope(user);
  const assignedEntity = assignedEntityLabel(user);

  const availableEntities = useMemo((): EntityId[] => {
    if (options.locked) return [options.locked];
    const perms = options.permissions ?? [
      Permission.COLLECT_PWS_FEES,
      Permission.COLLECT_ALPHA_FEES,
      Permission.CAPTURE_PWS_EXPENSES,
      Permission.CAPTURE_ALPHA_EXPENSES,
    ];
    const fromPerms = entitiesForPermissions(user, perms);
    if (fromPerms.length > 0) return fromPerms;
    if (assignedScope === "both") return ["pws", "alpha"];
    if (assignedScope === "pws" || assignedScope === "alpha") return [assignedScope];
    return ["pws"];
  }, [user, options.locked, options.permissions, assignedScope]);

  const resolvedDefault = useMemo((): EntityId => {
    if (options.locked) return options.locked;
    if (options.defaultEntity && availableEntities.includes(options.defaultEntity)) return options.defaultEntity;
    if (urlEntity && availableEntities.includes(urlEntity)) return urlEntity;
    if (assignedScope === "pws" || assignedScope === "alpha") return assignedScope;
    return availableEntities[0] || "pws";
  }, [options.locked, options.defaultEntity, urlEntity, availableEntities, assignedScope]);

  const [entity, setEntityState] = useState<EntityId>(resolvedDefault);

  useEffect(() => {
    setEntityState(resolvedDefault);
  }, [resolvedDefault]);

  useEffect(() => {
    if (!options.syncUrl || !urlEntity) return;
    if (!availableEntities.includes(urlEntity)) {
      router.setParams({ entity: resolvedDefault });
      return;
    }
    setEntityState(urlEntity);
  }, [options.syncUrl, urlEntity, availableEntities, resolvedDefault, router]);

  const setEntity = useCallback((next: EntityId) => {
    if (!availableEntities.includes(next)) return;
    if (!assertEntityAllowed(user, next)) return;
    setEntityState(next);
    if (options.syncUrl) router.setParams({ entity: next });
  }, [availableEntities, user, options.syncUrl, router]);

  const canSwitch = availableEntities.length > 1 && !options.locked;
  const isRestricted = !isMultiEntityUser(user) && assignedScope !== "both";

  return {
    entity,
    scope: options.allowBoth && isMultiEntityUser(user) ? "both" : entity,
    entityCode: toEntityCode(entity),
    institution: toEntityCode(entity),
    assignedEntity,
    assignedScope,
    availableEntities,
    canSwitch,
    isRestricted,
    setEntity,
    assertSubmitAllowed: (e: EntityId) => assertEntityAllowed(user, e) && availableEntities.includes(e),
    apiEntityParam: entity,
  };
}

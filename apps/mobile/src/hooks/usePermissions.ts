import { useCallback, useMemo } from 'react';
import type { MeUser } from '../types/me';
import { useProfileMe } from './useProfileMe';

function resolveAccess(me: MeUser | null | undefined) {
  const roles = me?.roles ?? [];
  const permissions = me?.permissions ?? [];
  const isSuperuser = !!(
    me?.is_superuser ||
    roles.includes('superuser')
  );
  return { roles, permissions, isSuperuser };
}

export function usePermissions(meOverride?: MeUser | null) {
  const shouldFetch = meOverride === undefined;
  const { me: fetchedMe } = useProfileMe(shouldFetch);
  const me = meOverride !== undefined ? meOverride : fetchedMe;

  const { roles, permissions, isSuperuser } = useMemo(
    () => resolveAccess(me),
    [me]
  );

  const can = useCallback(
    (permissionKey: string) => {
      if (isSuperuser) return true;
      if (permissions.includes('*')) return true;
      return permissions.includes(permissionKey);
    },
    [isSuperuser, permissions]
  );

  const hasRole = useCallback(
    (roleKey: string) => {
      if (roleKey === 'superuser') return isSuperuser;
      return roles.includes(roleKey);
    },
    [isSuperuser, roles]
  );

  return { roles, permissions, isSuperuser, can, hasRole };
}

export function usePermission(
  permissionKey: string,
  meOverride?: MeUser | null
): boolean {
  const { can } = usePermissions(meOverride);
  return can(permissionKey);
}

export function useHasRole(
  roleKey: string,
  meOverride?: MeUser | null
): boolean {
  const { hasRole } = usePermissions(meOverride);
  return hasRole(roleKey);
}

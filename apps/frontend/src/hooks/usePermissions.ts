import { useCallback, useMemo } from 'react';
import { useUserProfileContext } from '../contexts/UserProfileContext';

export interface PermissionsState {
  roles: string[];
  permissions: string[];
  isSuperuser: boolean;
  can: (permissionKey: string) => boolean;
  hasRole: (roleKey: string) => boolean;
}

export function usePermissions(): PermissionsState {
  const { profile } = useUserProfileContext();

  const roles = useMemo(() => profile?.roles ?? [], [profile?.roles]);
  const permissions = useMemo(
    () => profile?.permissions ?? [],
    [profile?.permissions]
  );
  const isSuperuser = !!(
    profile?.is_superuser ||
    roles.includes('superuser')
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

export function usePermission(permissionKey: string): boolean {
  const { can } = usePermissions();
  return can(permissionKey);
}

export function useHasRole(roleKey: string): boolean {
  const { hasRole } = usePermissions();
  return hasRole(roleKey);
}

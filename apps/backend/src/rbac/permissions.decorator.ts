import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';
export const ROLES_KEY = 'required_roles';

/** Require any of the listed permissions (OR). Superuser always passes. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Require any of the listed roles (OR). Superuser always passes. */
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);

import { SetMetadata } from '@nestjs/common';

export const DELEGATION_PERMISSIONS_KEY = 'required_delegation_permissions';

/** Require any of the listed delegation permission keys (OR). */
export const RequireDelegationPermissions = (...permissions: string[]) =>
  SetMetadata(DELEGATION_PERMISSIONS_KEY, permissions);

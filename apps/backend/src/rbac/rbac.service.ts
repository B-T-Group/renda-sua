import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildEffectiveAccess,
  globalRoleKeys,
  type DirectPermissionInput,
  type RoleGrantInput,
} from './geo-access.util';
import {
  EffectiveAccess,
  GeoScope,
  RoleGrant,
} from './platform-permissions';

/** A user holding at least one platform role, with the fields staff tooling needs. */
export interface PlatformRoleUser {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Raw `users.preferred_language`; normalize before using it as a locale. */
  preferredLanguage: string | null;
  /** ISO alpha-2 from `users.country`; null means global / unset. */
  country: string | null;
  roles: string[];
  grants: RoleGrant[];
}

export interface PlatformRoleRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  requiresGeoScope: boolean;
}

/** Per-request cache for effective RBAC resolution (set by RbacCacheInterceptor). */
export const rbacRequestStore = new AsyncLocalStorage<
  Map<string, EffectiveAccess>
>();

const ACCESS_QUERY = `
  query GetUserRbac($userId: uuid!) {
    user_roles(where: { user_id: { _eq: $userId } }) {
      country_code
      supported_country_state { country_code state_key state_name }
      role {
        key
        role_permissions { permission { key } }
      }
    }
    user_permissions(where: { user_id: { _eq: $userId } }) {
      effect
      permission { key }
    }
  }
`;

@Injectable()
export class RbacService {
  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getEffectiveAccess(userId: string): Promise<EffectiveAccess> {
    const store = rbacRequestStore.getStore();
    const cached = store?.get(userId);
    if (cached) return cached;
    const access = await this.loadEffectiveAccess(userId);
    store?.set(userId, access);
    return access;
  }

  invalidateUser(userId: string): void {
    rbacRequestStore.getStore()?.delete(userId);
  }

  /** Null when the user does not hold the key. Superuser is global. */
  async getScope(userId: string, permissionKey: string): Promise<GeoScope | null> {
    const access = await this.getEffectiveAccess(userId);
    if (access.isSuperuser) return { all: true };
    return access.scopes[permissionKey] ?? null;
  }

  /** Explicit role check; superuser does not imply other roles. */
  async hasRole(userId: string, roleKey: string): Promise<boolean> {
    const access = await this.getEffectiveAccess(userId);
    return access.roles.includes(roleKey);
  }

  /** True only for a global grant. Scoped grants fail closed. */
  async hasPermission(userId: string, permissionKey: string): Promise<boolean> {
    const scope = await this.getScope(userId, permissionKey);
    return scope?.all === true;
  }

  async hasAnyPermission(userId: string, permissionKeys: string[]): Promise<boolean> {
    if (!permissionKeys.length) return false;
    const access = await this.getEffectiveAccess(userId);
    if (access.isSuperuser) return true;
    return permissionKeys.some((key) => access.scopes[key]?.all === true);
  }

  async listRoles(): Promise<PlatformRoleRecord[]> {
    const result = await this.hasuraSystemService.executeQuery(`
      query ListRoles {
        roles(order_by: { key: asc }) {
          id key name description requires_geo_scope
        }
      }
    `);
    return (result.roles ?? []).map((role: any) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      requiresGeoScope: role.requires_geo_scope === true,
    }));
  }

  async listPermissions(): Promise<
    Array<{ id: string; key: string; description: string; category: string }>
  > {
    const result = await this.hasuraSystemService.executeQuery(`
      query ListPermissions {
        permissions(order_by: { key: asc }) {
          id key description category
        }
      }
    `);
    return result.permissions ?? [];
  }

  /** Global assignments only. Scoped roles are managed separately. */
  async getUserRoleKeys(userId: string): Promise<string[]> {
    const access = await this.getEffectiveAccess(userId);
    return globalRoleKeys(access.grants);
  }

  async setUserRoles(
    userId: string,
    roleKeys: string[],
    grantedBy: string | null
  ): Promise<string[]> {
    const roles = await this.listRoles();
    const byKey = new Map(roles.map((role) => [role.key, role]));
    const uniqueKeys = Array.from(new Set(roleKeys));
    this.assertAssignableRoles(uniqueKeys, byKey);
    await this.clearGlobalRoles(userId);
    await this.insertGlobalRoles(userId, uniqueKeys, byKey, grantedBy);
    this.invalidateUser(userId);
    return this.getUserRoleKeys(userId);
  }

  async listUsersWithRoles(): Promise<PlatformRoleUser[]> {
    const result = await this.hasuraSystemService.executeQuery(`
      query ListUsersWithRoles {
        user_roles {
          user_id
          country_code
          supported_country_state { state_key state_name }
          role { key }
          user {
            id email first_name last_name preferred_language country
          }
        }
      }
    `);
    return collectRoleUsers(result.user_roles ?? []);
  }

  private async loadEffectiveAccess(userId: string): Promise<EffectiveAccess> {
    const result = await this.hasuraSystemService.executeQuery(ACCESS_QUERY, { userId });
    return buildEffectiveAccess({
      grants: mapRoleGrants(result.user_roles ?? []),
      directs: mapDirects(result.user_permissions ?? []),
    });
  }

  private assertAssignableRoles(
    keys: string[],
    byKey: Map<string, PlatformRoleRecord>
  ): void {
    for (const key of keys) {
      const role = byKey.get(key);
      if (!role) throw new Error(`Unknown role: ${key}`);
      if (role.requiresGeoScope) {
        throw new Error(`Role ${key} must be assigned with a country`);
      }
    }
  }

  private async clearGlobalRoles(userId: string): Promise<void> {
    await this.hasuraSystemService.executeQuery(
      `mutation ClearUserRoles($userId: uuid!) {
        delete_user_roles(where: {
          user_id: { _eq: $userId }
          country_code: { _is_null: true }
        }) { affected_rows }
      }`,
      { userId }
    );
  }

  private async insertGlobalRoles(
    userId: string,
    keys: string[],
    byKey: Map<string, PlatformRoleRecord>,
    grantedBy: string | null
  ): Promise<void> {
    if (!keys.length) return;
    const objects = keys.map((key) => ({
      user_id: userId,
      role_id: byKey.get(key)?.id,
      granted_by: grantedBy,
    }));
    await this.hasuraSystemService.executeQuery(
      `mutation InsertUserRoles($objects: [user_roles_insert_input!]!) {
        insert_user_roles(objects: $objects) { affected_rows }
      }`,
      { objects }
    );
  }
}

function mapRoleGrants(rows: any[]): RoleGrantInput[] {
  return rows
    .map((row) => ({
      roleKey: row.role?.key as string,
      countryCode: normalizeCode(row.country_code),
      stateKey: (row.supported_country_state?.state_key as string) ?? null,
      stateName: (row.supported_country_state?.state_name as string) ?? null,
      permissionKeys: permissionKeysOf(row),
    }))
    .filter((row) => !!row.roleKey);
}

function permissionKeysOf(row: any): string[] {
  return (row.role?.role_permissions ?? [])
    .map((item: { permission?: { key?: string } }) => item.permission?.key)
    .filter((key: string | undefined): key is string => !!key);
}

function mapDirects(rows: any[]): DirectPermissionInput[] {
  return rows.map(toDirect).filter((row) => !!row.key);
}

function toDirect(row: any): DirectPermissionInput {
  return {
    effect: row.effect === 'deny' ? 'deny' : 'allow',
    key: (row.permission?.key as string) ?? '',
  };
}

function collectRoleUsers(rows: any[]): PlatformRoleUser[] {
  const byUser = new Map<string, PlatformRoleUser>();
  for (const row of rows) addRoleRow(byUser, row);
  return Array.from(byUser.values()).sort((a, b) =>
    (a.email ?? '').localeCompare(b.email ?? '')
  );
}

function addRoleRow(byUser: Map<string, PlatformRoleUser>, row: any): void {
  const userId = row.user_id as string;
  const existing = byUser.get(userId) ?? emptyRoleUser(userId, row.user);
  const roleKey = row.role?.key as string | undefined;
  if (roleKey && !existing.roles.includes(roleKey)) existing.roles.push(roleKey);
  if (roleKey) existing.grants.push(grantFromRow(roleKey, row));
  byUser.set(userId, existing);
}

function emptyRoleUser(userId: string, user: any): PlatformRoleUser {
  return {
    userId,
    email: user?.email ?? null,
    firstName: user?.first_name ?? null,
    lastName: user?.last_name ?? null,
    preferredLanguage: user?.preferred_language ?? null,
    country: normalizeStaffCountry(user?.country),
    roles: [],
    grants: [],
  };
}

function grantFromRow(role: string, row: any): RoleGrant {
  return {
    role,
    countryCode: normalizeCode(row.country_code),
    stateKey: row.supported_country_state?.state_key ?? null,
    stateName: row.supported_country_state?.state_name ?? null,
  };
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed || null;
}

function normalizeStaffCountry(value: unknown): string | null {
  return normalizeCode(value);
}

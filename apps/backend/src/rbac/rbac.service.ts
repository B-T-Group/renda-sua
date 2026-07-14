import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  EffectiveAccess,
  PlatformRoles,
} from './platform-permissions';

/** Per-request cache for effective RBAC resolution (set by RbacCacheInterceptor). */
export const rbacRequestStore = new AsyncLocalStorage<
  Map<string, EffectiveAccess>
>();

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

  private async loadEffectiveAccess(userId: string): Promise<EffectiveAccess> {
    const query = `
      query GetUserRbac($userId: uuid!) {
        user_roles(where: { user_id: { _eq: $userId } }) {
          role { key }
        }
        user_permissions(where: { user_id: { _eq: $userId } }) {
          effect
          permission { key }
        }
        role_permissions(
          where: { role: { user_roles: { user_id: { _eq: $userId } } } }
        ) {
          permission { key }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });

    const roles: string[] = (result.user_roles ?? [])
      .map((ur: { role?: { key?: string } }) => ur.role?.key)
      .filter((k: string | undefined): k is string => !!k);

    const isSuperuser = roles.includes(PlatformRoles.SUPERUSER);
    if (isSuperuser) {
      return { roles, permissions: ['*'], isSuperuser: true };
    }

    const fromRoles = new Set<string>(
      (result.role_permissions ?? [])
        .map((rp: { permission?: { key?: string } }) => rp.permission?.key)
        .filter((k: string | undefined): k is string => !!k)
    );

    const allow = new Set<string>();
    const deny = new Set<string>();
    for (const up of result.user_permissions ?? []) {
      const key = up?.permission?.key as string | undefined;
      if (!key) continue;
      if (up.effect === 'deny') deny.add(key);
      else allow.add(key);
    }

    for (const key of fromRoles) {
      if (!deny.has(key)) allow.add(key);
    }
    for (const key of deny) {
      allow.delete(key);
    }

    return {
      roles,
      permissions: Array.from(allow).sort(),
      isSuperuser: false,
    };
  }

  /** Explicit role check; superuser does not imply other roles. */
  async hasRole(userId: string, roleKey: string): Promise<boolean> {
    const access = await this.getEffectiveAccess(userId);
    return access.roles.includes(roleKey);
  }

  async hasPermission(
    userId: string,
    permissionKey: string
  ): Promise<boolean> {
    const access = await this.getEffectiveAccess(userId);
    if (access.isSuperuser) return true;
    return access.permissions.includes(permissionKey);
  }

  async hasAnyPermission(
    userId: string,
    permissionKeys: string[]
  ): Promise<boolean> {
    if (!permissionKeys.length) return false;
    const access = await this.getEffectiveAccess(userId);
    if (access.isSuperuser) return true;
    return permissionKeys.some((k) => access.permissions.includes(k));
  }

  async listRoles(): Promise<
    Array<{ id: string; key: string; name: string; description: string }>
  > {
    const result = await this.hasuraSystemService.executeQuery(`
      query ListRoles {
        roles(order_by: { key: asc }) {
          id
          key
          name
          description
        }
      }
    `);
    return result.roles ?? [];
  }

  async listPermissions(): Promise<
    Array<{
      id: string;
      key: string;
      description: string;
      category: string;
    }>
  > {
    const result = await this.hasuraSystemService.executeQuery(`
      query ListPermissions {
        permissions(order_by: { key: asc }) {
          id
          key
          description
          category
        }
      }
    `);
    return result.permissions ?? [];
  }

  async getUserRoleKeys(userId: string): Promise<string[]> {
    const access = await this.getEffectiveAccess(userId);
    return access.roles;
  }

  async setUserRoles(
    userId: string,
    roleKeys: string[],
    grantedBy: string | null
  ): Promise<string[]> {
    const roles = await this.listRoles();
    const byKey = new Map(roles.map((r) => [r.key, r.id]));
    const uniqueKeys = Array.from(new Set(roleKeys));
    for (const key of uniqueKeys) {
      if (!byKey.has(key)) {
        throw new Error(`Unknown role: ${key}`);
      }
    }

    await this.hasuraSystemService.executeQuery(
      `
      mutation ClearUserRoles($userId: uuid!) {
        delete_user_roles(where: { user_id: { _eq: $userId } }) {
          affected_rows
        }
      }
    `,
      { userId }
    );

    if (uniqueKeys.length) {
      const objects = uniqueKeys.map((key) => ({
        user_id: userId,
        role_id: byKey.get(key),
        granted_by: grantedBy,
      }));
      await this.hasuraSystemService.executeQuery(
        `
        mutation InsertUserRoles($objects: [user_roles_insert_input!]!) {
          insert_user_roles(objects: $objects) {
            affected_rows
          }
        }
      `,
        { objects }
      );
    }

    this.invalidateUser(userId);
    return this.getUserRoleKeys(userId);
  }

  async listUsersWithRoles(): Promise<
    Array<{
      userId: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      roles: string[];
    }>
  > {
    const result = await this.hasuraSystemService.executeQuery(`
      query ListUsersWithRoles {
        user_roles {
          user_id
          role { key }
          user {
            id
            email
            first_name
            last_name
          }
        }
      }
    `);
    const byUser = new Map<
      string,
      {
        userId: string;
        email: string | null;
        firstName: string | null;
        lastName: string | null;
        roles: string[];
      }
    >();
    for (const row of result.user_roles ?? []) {
      const userId = row.user_id as string;
      const existing = byUser.get(userId);
      const roleKey = row.role?.key as string | undefined;
      if (!existing) {
        byUser.set(userId, {
          userId,
          email: row.user?.email ?? null,
          firstName: row.user?.first_name ?? null,
          lastName: row.user?.last_name ?? null,
          roles: roleKey ? [roleKey] : [],
        });
      } else if (roleKey && !existing.roles.includes(roleKey)) {
        existing.roles.push(roleKey);
      }
    }
    return Array.from(byUser.values()).sort((a, b) =>
      (a.email ?? '').localeCompare(b.email ?? '')
    );
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PlatformRoles } from './platform-permissions';
import { RbacService, type PlatformRoleUser } from './rbac.service';

export interface ScopedGrantInput {
  role: string;
  countryCode: string;
  stateIds?: string[];
}

interface MarketState {
  id: string;
  name: string;
  countryCode: string;
  countryName: string;
}

interface RoleScopeRow {
  id: string;
  requires_geo_scope: boolean;
  role_permissions: Array<{ permission?: { geo_scopable?: boolean } }>;
}

/** A validation problem the superuser can fix; its message is safe to show. */
export class ScopedGrantError extends Error {}

/** Escape LIKE wildcards so '%' and '_' in an email match themselves. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class ScopedRolesService {
  constructor(
    private readonly hasura: HasuraSystemService,
    private readonly rbac: RbacService
  ) {}

  async listCountryAdmins(): Promise<PlatformRoleUser[]> {
    const users = await this.rbac.listUsersWithRoles();
    return users
      .map((user) => ({
        ...user,
        grants: user.grants.filter((grant) => grant.role === PlatformRoles.COUNTRY_ADMIN),
      }))
      .filter((user) => user.grants.length > 0);
  }

  async lookupByEmail(email: string) {
    const result = await this.hasura.executeQuery(
      `query UserByEmail($email: String!) {
        users(where: { email: { _ilike: $email } }, limit: 1) {
          id email first_name last_name
        }
      }`,
      { email: escapeLike(email.trim()) }
    );
    const user = result.users?.[0];
    if (!user) throw new NotFoundException('User not found');
    return {
      userId: user.id as string,
      email: user.email as string,
      firstName: user.first_name as string | null,
      lastName: user.last_name as string | null,
    };
  }

  async listMarkets() {
    const states = await this.loadStates();
    return groupMarkets(states);
  }

  async setScopedRoles(
    userId: string,
    grants: ScopedGrantInput[],
    grantedBy: string | null
  ) {
    await this.requireUser(userId);
    // Validate and expand everything first, so a bad request never touches existing grants.
    const objects = dedupeRows(await this.expandGrants(userId, grants, grantedBy));
    await this.replaceScoped(userId, objects);
    this.rbac.invalidateUser(userId);
    return this.grantsFor(userId);
  }

  private async requireUser(userId: string): Promise<void> {
    const result = await this.hasura.executeQuery(
      `query ScopedRoleUser($id: uuid!) { users_by_pk(id: $id) { id } }`,
      { id: userId }
    );
    if (!result.users_by_pk) throw new NotFoundException('User not found');
  }

  private async expandGrants(
    userId: string,
    grants: ScopedGrantInput[],
    grantedBy: string | null
  ) {
    const states = await this.loadStates();
    const objects = [];
    for (const grant of grants) {
      objects.push(...(await this.rowsForGrant(userId, grant, states, grantedBy)));
    }
    return objects;
  }

  private async rowsForGrant(
    userId: string,
    grant: ScopedGrantInput,
    states: MarketState[],
    grantedBy: string | null
  ) {
    const role = await this.requireScopedRole(grant.role);
    const country = grant.countryCode.trim().toUpperCase();
    const inCountry = states.filter((state) => state.countryCode === country);
    if (!inCountry.length) throw new ScopedGrantError(`Unknown country: ${country}`);
    const selected = this.selectedStates(grant.stateIds, inCountry, country);
    if (!selected) return [row(userId, role.id, country, null, grantedBy)];
    return selected.map((state) => row(userId, role.id, country, state.id, grantedBy));
  }

  private selectedStates(
    stateIds: string[] | undefined,
    inCountry: MarketState[],
    country: string
  ): MarketState[] | null {
    const ids = Array.from(new Set(stateIds ?? []));
    if (!ids.length || ids.length >= inCountry.length) {
      if (ids.length && ids.some((id) => !inCountry.some((state) => state.id === id))) {
        throw new ScopedGrantError(`State is not in ${country}`);
      }
      return null;
    }
    return ids.map((id) => {
      const state = inCountry.find((item) => item.id === id);
      if (!state) throw new ScopedGrantError(`State is not in ${country}`);
      return state;
    });
  }

  private async requireScopedRole(key: string): Promise<RoleScopeRow> {
    const result = await this.hasura.executeQuery(
      `query RoleScope($key: String!) {
        roles(where: { key: { _eq: $key } }) {
          id requires_geo_scope
          role_permissions { permission { geo_scopable } }
        }
      }`,
      { key }
    );
    const role = result.roles?.[0] as RoleScopeRow | undefined;
    if (!role) throw new ScopedGrantError(`Unknown role: ${key}`);
    if (!role.requires_geo_scope) throw new ScopedGrantError(`Role ${key} is assigned globally`);
    const globalPerm = (role.role_permissions ?? []).some(
      (item) => item.permission?.geo_scopable !== true
    );
    if (globalPerm) throw new ScopedGrantError(`Role ${key} includes a global permission`);
    return role;
  }

  private async loadStates(): Promise<MarketState[]> {
    const result = await this.hasura.executeQuery(`
      query ScopedMarkets {
        supported_country_states { id country_code country_name state_name }
      }
    `);
    return (result.supported_country_states ?? []).map((row: any) => ({
      id: row.id as string,
      name: row.state_name as string,
      countryCode: String(row.country_code).trim().toUpperCase(),
      countryName: row.country_name as string,
    }));
  }

  /**
   * Delete + insert in ONE Hasura mutation: root fields of a mutation run in a single
   * transaction, so a rejected insert rolls the delete back (no user left with zero grants).
   */
  private async replaceScoped(
    userId: string,
    objects: Array<Record<string, unknown>>
  ): Promise<void> {
    await this.hasura.executeQuery(
      `mutation ReplaceScopedRoles($userId: uuid!, $objects: [user_roles_insert_input!]!) {
        delete_user_roles(where: {
          user_id: { _eq: $userId }
          country_code: { _is_null: false }
        }) { affected_rows }
        insert_user_roles(objects: $objects) { affected_rows }
      }`,
      { userId, objects }
    );
  }

  private async grantsFor(userId: string) {
    const users = await this.rbac.listUsersWithRoles();
    const user = users.find((item) => item.userId === userId);
    return (user?.grants ?? []).filter((grant) => grant.countryCode);
  }
}

export function dedupeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = [r.user_id, r.role_id, r.country_code, r.supported_country_state_id].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function row(
  userId: string,
  roleId: string,
  country: string,
  stateId: string | null,
  grantedBy: string | null
) {
  return {
    user_id: userId,
    role_id: roleId,
    country_code: country,
    supported_country_state_id: stateId,
    granted_by: grantedBy,
  };
}

function groupMarkets(states: MarketState[]) {
  const byCountry = new Map<string, { countryCode: string; countryName: string; states: Array<{ id: string; name: string }> }>();
  for (const state of states) {
    const current = byCountry.get(state.countryCode) ?? {
      countryCode: state.countryCode,
      countryName: state.countryName,
      states: [],
    };
    current.states.push({ id: state.id, name: state.name });
    byCountry.set(state.countryCode, current);
  }
  return Array.from(byCountry.values());
}

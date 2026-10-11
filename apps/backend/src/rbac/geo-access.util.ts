import {
  PlatformRoles,
  type AdminScope,
  type EffectiveAccess,
  type GeoScope,
  type RoleGrant,
} from './platform-permissions';

export interface RoleGrantInput {
  roleKey: string;
  countryCode: string | null;
  stateKey: string | null;
  stateName: string | null;
  permissionKeys: string[];
}

export interface DirectPermissionInput {
  effect: 'allow' | 'deny';
  key: string;
}

export function buildEffectiveAccess(input: {
  grants: RoleGrantInput[];
  directs: DirectPermissionInput[];
}): EffectiveAccess {
  const roles = unique(input.grants.map((grant) => grant.roleKey));
  const grants = input.grants.map(toRoleGrant);
  if (roles.includes(PlatformRoles.SUPERUSER)) {
    return { roles, permissions: ['*'], isSuperuser: true, scopes: {}, grants };
  }
  const denied = new Set(
    input.directs.filter((row) => row.effect === 'deny').map((row) => row.key)
  );
  const scopes: Record<string, GeoScope> = {};
  for (const grant of input.grants) mergeGrant(scopes, grant, denied);
  for (const row of input.directs) mergeAllow(scopes, row, denied);
  return {
    roles,
    permissions: Object.keys(scopes).sort(),
    isSuperuser: false,
    scopes,
    grants,
  };
}

export function unionScopes(scopes: GeoScope[]): GeoScope | null {
  if (!scopes.length) return null;
  if (scopes.some((scope) => scope.all)) return { all: true };
  const countries = new Set<string>();
  const states: Array<{ countryCode: string; stateKey: string }> = [];
  for (const scope of scopes) {
    if (scope.all) continue;
    scope.countries.forEach((code) => countries.add(code));
    states.push(...scope.states);
  }
  return {
    all: false,
    countries: Array.from(countries),
    states: states.filter((state) => !countries.has(state.countryCode)),
  };
}

export function scopeAllowsGlobally(scope: GeoScope | null | undefined): boolean {
  return scope?.all === true;
}

export function adminScopesFromGrants(grants: RoleGrant[]): AdminScope[] {
  const byCountry = new Map<string, AdminScope>();
  for (const grant of grants) {
    if (grant.role !== PlatformRoles.COUNTRY_ADMIN || !grant.countryCode) continue;
    const existing = byCountry.get(grant.countryCode);
    byCountry.set(grant.countryCode, mergeAdminScope(existing, grant));
  }
  return Array.from(byCountry.values());
}

export function globalRoleKeys(grants: RoleGrant[]): string[] {
  return unique(
    grants.filter((grant) => !grant.countryCode).map((grant) => grant.role)
  );
}

function mergeGrant(
  scopes: Record<string, GeoScope>,
  grant: RoleGrantInput,
  denied: Set<string>
): void {
  for (const key of grant.permissionKeys) {
    if (denied.has(key)) continue;
    scopes[key] = mergeScope(scopes[key], grant.countryCode, grant.stateKey);
  }
}

function mergeAllow(
  scopes: Record<string, GeoScope>,
  row: DirectPermissionInput,
  denied: Set<string>
): void {
  if (row.effect === 'deny' || denied.has(row.key)) return;
  scopes[row.key] = { all: true };
}

function mergeScope(
  current: GeoScope | undefined,
  countryCode: string | null,
  stateKey: string | null
): GeoScope {
  if (!countryCode || current?.all) return { all: true };
  const base = current ?? { all: false, countries: [], states: [] };
  if (base.all) return base;
  if (!stateKey) return countryScope(base, countryCode);
  if (base.countries.includes(countryCode)) return base;
  if (base.states.some((state) => state.countryCode === countryCode && state.stateKey === stateKey)) {
    return base;
  }
  return { all: false, countries: base.countries, states: [...base.states, { countryCode, stateKey }] };
}

function countryScope(scope: Extract<GeoScope, { all: false }>, countryCode: string): GeoScope {
  return {
    all: false,
    countries: unique([...scope.countries, countryCode]),
    states: scope.states.filter((state) => state.countryCode !== countryCode),
  };
}

function mergeAdminScope(existing: AdminScope | undefined, grant: RoleGrant): AdminScope {
  if (!grant.stateKey || existing?.states === null) {
    return { countryCode: grant.countryCode as string, states: null };
  }
  const states = existing?.states ?? [];
  const name = grant.stateName || grant.stateKey;
  return {
    countryCode: grant.countryCode as string,
    states: states.includes(name) ? states : [...states, name],
  };
}

function toRoleGrant(grant: RoleGrantInput): RoleGrant {
  return {
    role: grant.roleKey,
    countryCode: grant.countryCode,
    stateKey: grant.stateKey,
    stateName: grant.stateName,
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

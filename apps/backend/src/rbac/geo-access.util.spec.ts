import { PlatformRoles } from './platform-permissions';
import {
  adminScopesFromGrants,
  buildEffectiveAccess,
  globalRoleKeys,
  scopeAllowsGlobally,
  unionScopes,
  type DirectPermissionInput,
  type RoleGrantInput,
} from './geo-access.util';

const ORDERS = 'platform.orders.cross_business';

function grant(over: Partial<RoleGrantInput> = {}): RoleGrantInput {
  return {
    roleKey: PlatformRoles.COUNTRY_ADMIN,
    countryCode: 'CM',
    stateKey: null,
    stateName: null,
    permissionKeys: [ORDERS],
    ...over,
  };
}

describe('buildEffectiveAccess', () => {
  it('gives a superuser every permission and keeps the grants', () => {
    const access = buildEffectiveAccess({
      grants: [grant({ roleKey: PlatformRoles.SUPERUSER, countryCode: null, permissionKeys: [] })],
      directs: [{ effect: 'deny', key: ORDERS }],
    });

    expect(access.isSuperuser).toBe(true);
    expect(access.permissions).toEqual(['*']);
    expect(access.scopes).toEqual({});
    expect(access.grants).toEqual([
      { role: PlatformRoles.SUPERUSER, countryCode: null, stateKey: null, stateName: null },
    ]);
  });

  it('treats a grant with no country as global, even when a state is set', () => {
    const access = buildEffectiveAccess({
      grants: [grant({ countryCode: null, stateKey: 'littoral' })],
      directs: [],
    });

    expect(access.scopes[ORDERS]).toEqual({ all: true });
  });

  it('lets a later country grant absorb that country\'s states and leave other states', () => {
    const access = buildEffectiveAccess({
      grants: [
        grant({ stateKey: 'littoral', permissionKeys: [ORDERS] }),
        grant({ countryCode: 'GA', stateKey: 'estuaire', permissionKeys: [ORDERS] }),
        grant({ countryCode: 'CM', stateKey: null, permissionKeys: [ORDERS] }),
      ],
      directs: [],
    });

    expect(access.scopes[ORDERS]).toEqual({
      all: false,
      countries: ['CM'],
      states: [{ countryCode: 'GA', stateKey: 'estuaire' }],
    });
  });

  it('does not let a state grant narrow a country grant, and ignores a duplicate state', () => {
    const access = buildEffectiveAccess({
      grants: [
        grant({ stateKey: null }),
        grant({ stateKey: 'littoral' }),
        grant({ countryCode: 'GA', stateKey: 'estuaire' }),
        grant({ countryCode: 'GA', stateKey: 'estuaire' }),
      ],
      directs: [],
    });

    expect(access.scopes[ORDERS]).toEqual({
      all: false,
      countries: ['CM'],
      states: [{ countryCode: 'GA', stateKey: 'estuaire' }],
    });
  });

  it('drops a denied key from role grants and from a direct allow', () => {
    const directs: DirectPermissionInput[] = [
      { effect: 'deny', key: ORDERS },
      { effect: 'allow', key: ORDERS },
      { effect: 'allow', key: 'platform.ops.map' },
    ];
    const access = buildEffectiveAccess({
      grants: [grant({ stateKey: 'littoral' })],
      directs,
    });

    expect(access.permissions).toEqual(['platform.ops.map']);
    expect(access.scopes[ORDERS]).toBeUndefined();
    expect(access.scopes['platform.ops.map']).toEqual({ all: true });
  });

  it('widens a state grant to global when the same key is directly allowed', () => {
    const access = buildEffectiveAccess({
      grants: [grant({ stateKey: 'littoral' })],
      directs: [{ effect: 'allow', key: ORDERS }],
    });

    expect(access.scopes[ORDERS]).toEqual({ all: true });
  });

  it('sorts permission keys and lists each role once', () => {
    const access = buildEffectiveAccess({
      grants: [
        grant({ permissionKeys: ['platform.ops.map'] }),
        grant({ permissionKeys: [ORDERS] }),
      ],
      directs: [],
    });

    expect(access.roles).toEqual([PlatformRoles.COUNTRY_ADMIN]);
    expect(access.permissions).toEqual(['platform.ops.map', ORDERS]);
  });
});

describe('unionScopes', () => {
  it('returns null for no scopes and global when any scope is global', () => {
    expect(unionScopes([])).toBeNull();
    expect(
      unionScopes([
        { all: false, countries: ['CM'], states: [] },
        { all: true },
      ])
    ).toEqual({ all: true });
  });

  it('keeps states only for countries that are not already granted whole', () => {
    expect(
      unionScopes([
        { all: false, countries: ['CM'], states: [{ countryCode: 'CM', stateKey: 'littoral' }] },
        { all: false, countries: [], states: [{ countryCode: 'GA', stateKey: 'estuaire' }] },
      ])
    ).toEqual({
      all: false,
      countries: ['CM'],
      states: [{ countryCode: 'GA', stateKey: 'estuaire' }],
    });
  });

  it('does not dedupe two identical state scopes', () => {
    const state = { countryCode: 'CM', stateKey: 'littoral' };
    expect(
      unionScopes([
        { all: false, countries: [], states: [state] },
        { all: false, countries: [], states: [state] },
      ])
    ).toEqual({ all: false, countries: [], states: [state, state] });
  });
});

describe('admin scope summaries', () => {
  const row = (over: Partial<RoleGrantInput>) =>
    ({
      role: over.roleKey ?? PlatformRoles.COUNTRY_ADMIN,
      countryCode: over.countryCode === undefined ? 'CM' : over.countryCode,
      stateKey: over.stateKey ?? null,
      stateName: over.stateName ?? null,
    });

  it('ignores other roles and country admins with no country', () => {
    expect(
      adminScopesFromGrants([
        row({ roleKey: PlatformRoles.MODERATOR, countryCode: null }),
        row({ countryCode: null, stateKey: 'littoral' }),
      ])
    ).toEqual([]);
  });

  it('widens to the whole country and does not narrow again', () => {
    expect(
      adminScopesFromGrants([
        row({ stateKey: 'littoral', stateName: 'Littoral' }),
        row({ stateKey: null }),
        row({ stateKey: 'centre', stateName: 'Centre' }),
      ])
    ).toEqual([{ countryCode: 'CM', states: null }]);
  });

  it('lists state names once and falls back to the state key', () => {
    expect(
      adminScopesFromGrants([
        row({ stateKey: 'littoral', stateName: 'Littoral' }),
        row({ stateKey: 'littoral', stateName: 'Littoral' }),
        row({ countryCode: 'GA', stateKey: 'estuaire', stateName: '' }),
      ])
    ).toEqual([
      { countryCode: 'CM', states: ['Littoral'] },
      { countryCode: 'GA', states: ['estuaire'] },
    ]);
  });

  it('reads global role keys only from grants with no country', () => {
    expect(
      globalRoleKeys([
        row({ roleKey: PlatformRoles.MODERATOR, countryCode: null }),
        row({ roleKey: PlatformRoles.MODERATOR, countryCode: null }),
        row({ roleKey: PlatformRoles.COUNTRY_ADMIN }),
      ])
    ).toEqual([PlatformRoles.MODERATOR]);
    expect(scopeAllowsGlobally(undefined)).toBe(false);
    expect(scopeAllowsGlobally({ all: false, countries: ['CM'], states: [] })).toBe(false);
    expect(scopeAllowsGlobally({ all: true })).toBe(true);
  });
});

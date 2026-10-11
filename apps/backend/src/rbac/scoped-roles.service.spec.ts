import { HasuraSystemService } from '../hasura/hasura-system.service';
import { RbacService } from './rbac.service';
import { NotFoundException } from '@nestjs/common';
import { escapeLike, ScopedGrantError, ScopedRolesService } from './scoped-roles.service';

const USER = '11111111-1111-4111-8111-111111111111';
const LITTORAL = '22222222-2222-4222-8222-222222222222';
const CENTRE = '33333333-3333-4333-8333-333333333333';

describe('ScopedRolesService.setScopedRoles', () => {
  let executeQuery: jest.Mock;
  let service: ScopedRolesService;

  beforeEach(() => {
    executeQuery = jest.fn(async (query: string) => {
      if (query.includes('ScopedMarkets')) return markets();
      if (query.includes('RoleScope')) return scopedRole();
      if (query.includes('ScopedRoleUser')) return { users_by_pk: { id: USER } };
      if (query.includes('ListUsersWithRoles')) return { user_roles: [] };
      return { delete_user_roles: { affected_rows: 1 }, insert_user_roles: { affected_rows: 1 } };
    });
    service = new ScopedRolesService(
      { executeQuery } as unknown as HasuraSystemService,
      { invalidateUser: jest.fn(), listUsersWithRoles: async () => [] } as unknown as RbacService
    );
  });

  it('collapses every state in the country into one country row', async () => {
    await service.setScopedRoles(
      USER,
      [{ role: 'country_admin', countryCode: 'cm', stateIds: [LITTORAL, CENTRE] }],
      null
    );
    const inserted = executeQuery.mock.calls.find((call) => String(call[0]).includes('ReplaceScopedRoles'));
    expect(inserted?.[1].objects).toEqual([
      expect.objectContaining({ country_code: 'CM', supported_country_state_id: null }),
    ]);
  });

  it('F-CA2: replaces grants in ONE mutation (delete + insert are the same transaction)', async () => {
    await service.setScopedRoles(USER, [{ role: 'country_admin', countryCode: 'CM' }], null);
    const writes = executeQuery.mock.calls.filter((c) => /mutation /.test(String(c[0])));
    expect(writes).toHaveLength(1);
    expect(String(writes[0][0])).toContain('delete_user_roles');
    expect(String(writes[0][0])).toContain('insert_user_roles');
  });

  it('F-CA2: an invalid or duplicate request never reaches the database mutation (existing grants kept)', async () => {
    await expect(
      service.setScopedRoles(USER, [{ role: 'country_admin', countryCode: 'ZZ' }], null)
    ).rejects.toBeInstanceOf(ScopedGrantError);
    expect(executeQuery.mock.calls.some((c) => /mutation /.test(String(c[0])))).toBe(false);
  });

  it('F-CA2: duplicate grants are collapsed instead of tripping the unique constraint', async () => {
    await service.setScopedRoles(
      USER,
      [
        { role: 'country_admin', countryCode: 'CM' },
        { role: 'country_admin', countryCode: 'cm' },
        { role: 'country_admin', countryCode: 'CM', stateIds: [LITTORAL] },
      ],
      null
    );
    const call = executeQuery.mock.calls.find((c) => String(c[0]).includes('ReplaceScopedRoles'));
    // CM whole-country, CM again (same) and CM/Littoral are distinct rows; only the exact repeat is dropped
    expect(call?.[1].objects).toHaveLength(2);
  });

  it('F-CA3: unknown user is a clean 404 before any write', async () => {
    executeQuery.mockImplementation(async (query: string) =>
      query.includes('ScopedRoleUser') ? { users_by_pk: null } : {}
    );
    await expect(
      service.setScopedRoles(USER, [{ role: 'country_admin', countryCode: 'CM' }], null)
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(executeQuery.mock.calls.some((c) => /mutation /.test(String(c[0])))).toBe(false);
  });

  it('rejects a role that is not geo scoped', async () => {
    executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ScopedRoleUser')) return { users_by_pk: { id: USER } };
      if (query.includes('ScopedMarkets')) return markets();
      if (query.includes('RoleScope')) {
        return { roles: [{ id: 'role', requires_geo_scope: false, role_permissions: [] }] };
      }
      return {};
    });
    await expect(
      service.setScopedRoles(USER, [{ role: 'support', countryCode: 'CM' }], null)
    ).rejects.toThrow('assigned globally');
  });
});

describe('lookupByEmail', () => {
  it('F-CA4: escapes % and _ so they match literally', async () => {
    const executeQuery = jest.fn().mockResolvedValue({ users: [{ id: USER, email: 'a_b@x.com' }] });
    const svc = new ScopedRolesService({ executeQuery } as any, {} as any);
    await svc.lookupByEmail(' a_b%@x.com ');
    expect(executeQuery.mock.calls[0][1].email).toBe('a\\_b\\%@x.com');
  });
  it('escapeLike handles backslashes too', () => {
    expect(escapeLike('%_\\')).toBe('\\%\\_\\\\');
  });
});

function markets() {
  return {
    supported_country_states: [
      { id: LITTORAL, country_code: 'CM', country_name: 'Cameroon', state_name: 'Littoral' },
      { id: CENTRE, country_code: 'CM', country_name: 'Cameroon', state_name: 'Centre' },
    ],
  };
}

function scopedRole() {
  return {
    roles: [
      {
        id: 'role-1',
        requires_geo_scope: true,
        role_permissions: [{ permission: { geo_scopable: true } }],
      },
    ],
  };
}

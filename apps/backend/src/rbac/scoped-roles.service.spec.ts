import { HasuraSystemService } from '../hasura/hasura-system.service';
import { RbacService } from './rbac.service';
import { ScopedRolesService } from './scoped-roles.service';

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
    const inserted = executeQuery.mock.calls.find((call) => String(call[0]).includes('InsertScopedRoles'));
    expect(inserted?.[1].objects).toEqual([
      expect.objectContaining({ country_code: 'CM', supported_country_state_id: null }),
    ]);
  });

  it('rejects a role that is not geo scoped', async () => {
    executeQuery.mockImplementation(async (query: string) => {
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

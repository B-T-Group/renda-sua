import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  PlatformPermissions,
  PlatformRoles,
} from './platform-permissions';
import { RbacService, rbacRequestStore } from './rbac.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function grant(role: string, keys: string[], country: string | null = null) {
  return {
    country_code: country,
    supported_country_state: null,
    role: {
      key: role,
      role_permissions: keys.map((key) => ({ permission: { key } })),
    },
  };
}

describe('RbacService', () => {
  let executeQuery: jest.Mock;
  let service: RbacService;

  beforeEach(() => {
    executeQuery = jest.fn();
    service = new RbacService({
      executeQuery,
    } as unknown as HasuraSystemService);
  });

  it('applies direct denies over role permissions', async () => {
    executeQuery.mockResolvedValue({
      user_roles: [
        grant(PlatformRoles.MODERATOR, [
          PlatformPermissions.MODERATE_ITEMS,
          PlatformPermissions.MODERATE_RENTALS,
        ]),
      ],
      user_permissions: [
        {
          effect: 'deny',
          permission: { key: PlatformPermissions.MODERATE_ITEMS },
        },
        {
          effect: 'allow',
          permission: { key: PlatformPermissions.OPS_USER_DOCUMENTS },
        },
      ],
    });

    const access = await service.getEffectiveAccess(USER_ID);
    expect(access.roles).toEqual([PlatformRoles.MODERATOR]);
    expect(access.isSuperuser).toBe(false);
    expect(access.permissions).toEqual([
      PlatformPermissions.MODERATE_RENTALS,
      PlatformPermissions.OPS_USER_DOCUMENTS,
    ]);
    expect(access.scopes[PlatformPermissions.MODERATE_ITEMS]).toBeUndefined();
    expect(access.scopes[PlatformPermissions.MODERATE_RENTALS]).toEqual({ all: true });
  });

  it('grants every permission to superusers', async () => {
    executeQuery.mockResolvedValue({
      user_roles: [grant(PlatformRoles.SUPERUSER, [])],
      user_permissions: [],
    });

    await rbacRequestStore.run(new Map(), async () => {
      await expect(
        service.hasPermission(USER_ID, PlatformPermissions.FINANCIAL_REFUNDS)
      ).resolves.toBe(true);
      await expect(
        service.hasRole(USER_ID, PlatformRoles.SUPERUSER)
      ).resolves.toBe(true);
    });
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it('invalidates effective access cached for the current request', async () => {
    executeQuery.mockResolvedValue({
      user_roles: [],
      user_permissions: [],
    });

    await rbacRequestStore.run(new Map(), async () => {
      await service.getEffectiveAccess(USER_ID);
      await service.getEffectiveAccess(USER_ID);
      service.invalidateUser(USER_ID);
      await service.getEffectiveAccess(USER_ID);
    });

    expect(executeQuery).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown role keys before changing assignments', async () => {
    executeQuery.mockResolvedValue({
      roles: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          key: PlatformRoles.MODERATOR,
          name: 'Moderator',
          description: 'Moderates content',
          requires_geo_scope: false,
        },
      ],
    });

    await expect(
      service.setUserRoles(USER_ID, ['unknown-role'], null)
    ).rejects.toThrow('Unknown role: unknown-role');
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });

  it('does not treat a country grant as a global permission', async () => {
    executeQuery.mockResolvedValue({
      user_roles: [
        grant(PlatformRoles.COUNTRY_ADMIN, [PlatformPermissions.ORDERS_CROSS_BUSINESS], 'CM'),
      ],
      user_permissions: [],
    });

    await rbacRequestStore.run(new Map(), async () => {
      await expect(
        service.hasPermission(USER_ID, PlatformPermissions.ORDERS_CROSS_BUSINESS)
      ).resolves.toBe(false);
      await expect(
        service.getScope(USER_ID, PlatformPermissions.ORDERS_CROSS_BUSINESS)
      ).resolves.toEqual({ all: false, countries: ['CM'], states: [] });
    });
  });

  it('rejects geo-scoped roles on the global assignment path', async () => {
    executeQuery.mockResolvedValue({
      roles: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          key: PlatformRoles.COUNTRY_ADMIN,
          name: 'Country admin',
          description: 'Scoped',
          requires_geo_scope: true,
        },
      ],
    });

    await expect(
      service.setUserRoles(USER_ID, [PlatformRoles.COUNTRY_ADMIN], null)
    ).rejects.toThrow('must be assigned with a country');
  });
});

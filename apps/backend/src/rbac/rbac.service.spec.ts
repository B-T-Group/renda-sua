import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  PlatformPermissions,
  PlatformRoles,
} from './platform-permissions';
import { RbacService, rbacRequestStore } from './rbac.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

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
      user_roles: [{ role: { key: PlatformRoles.MODERATOR } }],
      role_permissions: [
        { permission: { key: PlatformPermissions.MODERATE_ITEMS } },
        { permission: { key: PlatformPermissions.MODERATE_RENTALS } },
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

    await expect(service.getEffectiveAccess(USER_ID)).resolves.toEqual({
      roles: [PlatformRoles.MODERATOR],
      permissions: [
        PlatformPermissions.MODERATE_RENTALS,
        PlatformPermissions.OPS_USER_DOCUMENTS,
      ],
      isSuperuser: false,
    });
  });

  it('grants every permission to superusers', async () => {
    executeQuery.mockResolvedValue({
      user_roles: [{ role: { key: PlatformRoles.SUPERUSER } }],
      role_permissions: [],
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
      role_permissions: [],
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
        },
      ],
    });

    await expect(
      service.setUserRoles(USER_ID, ['unknown-role'], null)
    ).rejects.toThrow('Unknown role: unknown-role');
    expect(executeQuery).toHaveBeenCalledTimes(1);
  });
});

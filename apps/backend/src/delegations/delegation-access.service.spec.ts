import { HttpStatus } from '@nestjs/common';
import { DelegationAccessService } from './delegation-access.service';
import { DELEGATION_PERMISSIONS } from './delegation.constants';

describe('DelegationAccessService', () => {
  let hasura: { executeQuery: jest.Mock };
  let service: DelegationAccessService;

  const grantRow = {
    id: 'grant-1',
    user_id: 'user-1',
    business_location_id: 'loc-1',
    status: 'active',
    role: {
      id: 'role-om',
      key: 'order_manager',
      name: 'Order Manager',
      role_permissions: [
        { permission: { key: DELEGATION_PERMISSIONS.ORDERS_READ } },
        { permission: { key: DELEGATION_PERMISSIONS.ORDERS_MANAGE } },
      ],
    },
    business_location: {
      id: 'loc-1',
      name: 'Downtown',
      business_id: 'biz-1',
      business: { id: 'biz-1', name: 'Acme' },
    },
  };

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    service = new DelegationAccessService(hasura as any);
  });

  it('resolves live permissions from the current role_id', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: grantRow,
    });
    const ctx = await service.resolve('user-1', 'grant-1');
    expect(ctx.permissions).toEqual([
      DELEGATION_PERMISSIONS.ORDERS_READ,
      DELEGATION_PERMISSIONS.ORDERS_MANAGE,
    ]);
    expect(ctx.locationId).toBe('loc-1');
  });

  it('picks up an elevated role on the next resolve', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: {
        ...grantRow,
        role: {
          id: 'role-lm',
          key: 'location_manager',
          name: 'Location Manager',
          role_permissions: [
            { permission: { key: DELEGATION_PERMISSIONS.ORDERS_MANAGE } },
            { permission: { key: DELEGATION_PERMISSIONS.ITEMS_MANAGE } },
          ],
        },
      },
    });
    const ctx = await service.resolve('user-1', 'grant-1');
    expect(ctx.role.key).toBe('location_manager');
    expect(ctx.permissions).toContain(DELEGATION_PERMISSIONS.ITEMS_MANAGE);
    await expect(
      service.assertHasPermission(ctx, [DELEGATION_PERMISSIONS.ITEMS_MANAGE])
    ).resolves.toBeUndefined();
  });

  it('forbids a revoked or foreign grant', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: { ...grantRow, status: 'revoked' },
    });
    await expect(service.resolve('user-1', 'grant-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('forbids a grant that belongs to another user', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: { ...grantRow, user_id: 'other-user' },
    });
    await expect(service.resolve('user-1', 'grant-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('forbids a grant whose location is no longer owned', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: {
        ...grantRow,
        business_location: {
          ...grantRow.business_location,
          business_id: 'biz-1',
          business: { id: 'biz-other', name: 'Moved' },
        },
      },
    });
    await expect(service.resolve('user-1', 'grant-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('requires at least one of the live permission keys', async () => {
    hasura.executeQuery.mockResolvedValue({
      location_delegations_by_pk: grantRow,
    });
    const ctx = await service.resolve('user-1', 'grant-1');
    await expect(
      service.assertHasPermission(ctx, [DELEGATION_PERMISSIONS.ITEMS_MANAGE])
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    await expect(service.assertHasPermission(ctx, [])).resolves.toBeUndefined();
  });
});

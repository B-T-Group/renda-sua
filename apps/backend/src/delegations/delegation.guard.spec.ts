import { HttpStatus } from '@nestjs/common';
import { DelegationGuard } from './delegation.guard';
import { DELEGATION_PERMISSIONS } from './delegation.constants';

describe('DelegationGuard', () => {
  const resolved = {
    userId: 'user-1',
    delegationId: 'grant-1',
    businessId: 'biz-1',
    locationId: 'loc-1',
    role: { id: 'role-om', key: 'order_manager', name: 'Order Manager' },
    permissions: [
      DELEGATION_PERMISSIONS.ORDERS_READ,
      DELEGATION_PERMISSIONS.ORDERS_MANAGE,
    ],
  };

  let flag: { isEnabled: jest.Mock };
  let access: { resolve: jest.Mock; assertHasPermission: jest.Mock };
  let hasuraUser: { resolveContext: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: DelegationGuard;

  beforeEach(() => {
    flag = { isEnabled: jest.fn().mockResolvedValue(true) };
    access = {
      resolve: jest.fn().mockResolvedValue(resolved),
      assertHasPermission: jest.fn().mockResolvedValue(undefined),
    };
    hasuraUser = {
      resolveContext: jest.fn().mockReturnValue({
        userId: 'user-1',
        activeDelegation: 'grant-1',
      }),
    };
    reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([DELEGATION_PERMISSIONS.ORDERS_MANAGE]),
    };
    guard = new DelegationGuard(
      reflector as any,
      flag as any,
      access as any,
      hasuraUser as any
    );
  });

  function httpContext(request: Record<string, unknown> = {}) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  }

  it('returns 404 when the feature flag is off', async () => {
    flag.isEnabled.mockResolvedValue(false);
    await expect(guard.canActivate(httpContext())).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('requires X-Active-Delegation', async () => {
    hasuraUser.resolveContext.mockReturnValue({
      userId: 'user-1',
      activeDelegation: '',
    });
    await expect(guard.canActivate(httpContext())).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('checks live permission keys then attaches context', async () => {
    const request: Record<string, unknown> = {};
    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(access.resolve).toHaveBeenCalledWith('user-1', 'grant-1');
    expect(access.assertHasPermission).toHaveBeenCalledWith(resolved, [
      DELEGATION_PERMISSIONS.ORDERS_MANAGE,
    ]);
    expect(request.delegation).toEqual(resolved);
  });
});

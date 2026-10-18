import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { DelegationAccessService } from '../delegations/delegation-access.service';
import type { LocationDelegationsFlagService } from '../delegations/location-delegations-flag.service';
import type { HasuraSystemService } from '../hasura/hasura-system.service';
import type { HasuraUserService } from '../hasura/hasura-user.service';
import { DedicatedLocationAccessService } from './dedicated-location-access.service';

const LOC = 'loc-1';

/** Real DelegationAccessService over a fake Hasura, so the permission check itself is exercised. */
function setup(opts: {
  userId?: string;
  delegationId?: string;
  delegationsFlag?: boolean;
  delegation?: { user_id: string; location: string; status?: string; permissions: string[] };
}) {
  const executeQuery = jest.fn(async (query: string, vars: any) => {
    const op = /query (\w+)/.exec(query)?.[1];
    if (op === 'DedicatedLocationOwner') {
      return {
        business_locations_by_pk:
          vars.locationId === LOC || vars.locationId === 'loc-2'
            ? { id: vars.locationId, business_id: vars.locationId === LOC ? 'biz-1' : 'biz-2', business: { user_id: vars.locationId === LOC ? 'u-owner' : 'u-other' } }
            : null,
      };
    }
    if (op === 'DelegationByPk') {
      const d = opts.delegation;
      if (!d || vars.id !== 'del-1') return { location_delegations_by_pk: null };
      const businessId = d.location === LOC ? 'biz-1' : 'biz-2';
      return {
        location_delegations_by_pk: {
          id: 'del-1',
          user_id: d.user_id,
          business_location_id: d.location,
          status: d.status ?? 'active',
          role: { id: 'r', key: 'staff', name: 'Staff', role_permissions: d.permissions.map((key) => ({ permission: { key } })) },
          business_location: { id: d.location, name: 'L', business_id: businessId, business: { id: businessId, name: 'B' } },
        },
      };
    }
    throw new Error(`unexpected ${op}`);
  });
  const hasura = { executeQuery } as unknown as HasuraSystemService;
  const users = {
    getUserId: () => opts.userId ?? 'anonymous',
    resolveContext: () => ({ activeDelegation: opts.delegationId }),
  } as unknown as HasuraUserService;
  const flag = { isEnabled: jest.fn(async () => opts.delegationsFlag ?? true) } as unknown as LocationDelegationsFlagService;
  return new DedicatedLocationAccessService(hasura, users, new DelegationAccessService(hasura), flag);
}

const status = async (p: Promise<unknown>) =>
  p.then(
    () => 200,
    (e) => (e instanceof HttpException ? e.getStatus() : 500)
  );

describe('DedicatedLocationAccessService', () => {
  it('the owner passes without a delegation', async () => {
    await expect(setup({ userId: 'u-owner' }).resolve(LOC)).resolves.toMatchObject({ via: 'owner', businessId: 'biz-1' });
  });

  it('a delegate of this location with delegation.dedicated_agents.manage passes', async () => {
    const svc = setup({
      userId: 'u-del',
      delegationId: 'del-1',
      delegation: { user_id: 'u-del', location: LOC, permissions: ['delegation.orders.read', 'delegation.dedicated_agents.manage'] },
    });
    await expect(svc.resolve(LOC)).resolves.toMatchObject({ via: 'delegate', delegationId: 'del-1', userId: 'u-del' });
  });

  it('a delegate without the permission is 403', async () => {
    const svc = setup({
      userId: 'u-del',
      delegationId: 'del-1',
      delegation: { user_id: 'u-del', location: LOC, permissions: ['delegation.orders.manage'] },
    });
    expect(await status(svc.resolve(LOC))).toBe(403);
  });

  it('a delegate of another location is 403 even with the permission', async () => {
    const svc = setup({
      userId: 'u-del',
      delegationId: 'del-1',
      delegation: { user_id: 'u-del', location: 'loc-2', permissions: ['delegation.dedicated_agents.manage'] },
    });
    expect(await status(svc.resolve(LOC))).toBe(403);
  });

  it('a revoked delegation, someone else’s delegation, or delegations turned off is 403', async () => {
    const perms = ['delegation.dedicated_agents.manage'];
    expect(
      await status(setup({ userId: 'u-del', delegationId: 'del-1', delegation: { user_id: 'u-del', location: LOC, status: 'revoked', permissions: perms } }).resolve(LOC))
    ).toBe(403);
    expect(
      await status(setup({ userId: 'u-x', delegationId: 'del-1', delegation: { user_id: 'u-del', location: LOC, permissions: perms } }).resolve(LOC))
    ).toBe(403);
    expect(
      await status(
        setup({ userId: 'u-del', delegationId: 'del-1', delegationsFlag: false, delegation: { user_id: 'u-del', location: LOC, permissions: perms } }).resolve(LOC)
      )
    ).toBe(403);
  });

  it('another business owner (no delegation) and anonymous are 403; unknown location is 404', async () => {
    await expect(setup({ userId: 'u-other' }).resolve(LOC)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup({}).resolve(LOC)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(setup({ userId: 'u-owner' }).resolve('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

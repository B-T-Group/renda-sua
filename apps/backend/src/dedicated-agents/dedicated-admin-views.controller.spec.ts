import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import type { PermissionService } from '../auth/permission.service';
import type { HasuraUserService } from '../hasura/hasura-user.service';
import type { GeoScopeService } from '../rbac/geo-scope.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import type { RbacService } from '../rbac/rbac.service';
import { DedicatedAdminPostingsController, DedicatedAdminViewsController } from './dedicated-admin-views.controller';
import type { DedicatedAdminViewsService } from './dedicated-admin-views.service';

function guardFor(access: { isSuperuser: boolean; roles: string[]; permissions: string[] }) {
  const users = { getUser: jest.fn(async () => ({ id: 'u-1' })) } as unknown as HasuraUserService;
  const rbac = { getEffectiveAccess: jest.fn(async () => access) } as unknown as RbacService;
  const perms = { isBusinessAdmin: jest.fn(async () => true) } as unknown as PermissionService;
  return new AdminAuthGuard(new Reflector(), users, perms, rbac);
}
type Ctl = { prototype: object };
const ctxFor = (cls: Ctl, handler: string): ExecutionContext =>
  ({
    getHandler: () => (cls.prototype as Record<string, unknown>)[handler],
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }) as unknown as ExecutionContext;

const routes: Array<[Ctl, string]> = [
  [DedicatedAdminViewsController, 'list'],
  [DedicatedAdminViewsController, 'coverage'],
  [DedicatedAdminViewsController, 'picker'],
  [DedicatedAdminViewsController, 'dismissRelation'],
  [DedicatedAdminViewsController, 'searchLocations'],
  [DedicatedAdminViewsController, 'capability'],
  [DedicatedAdminViewsController, 'locationPickupSlots'],
  [DedicatedAdminPostingsController, 'list'],
  [DedicatedAdminPostingsController, 'close'],
];

describe('PR 8 admin view controllers', () => {
  it('both controllers sit behind AdminAuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DedicatedAdminViewsController)).toContain(AdminAuthGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, DedicatedAdminPostingsController)).toContain(AdminAuthGuard);
  });

  it.each(routes)('%p.%s: denied without platform.manage.agents; allowed with it or as superuser', async (cls, handler) => {
    await expect(
      guardFor({ isSuperuser: false, roles: ['support'], permissions: ['platform.users.read'] }).canActivate(ctxFor(cls, handler))
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guardFor({ isSuperuser: true, roles: [], permissions: [] }).canActivate(ctxFor(cls, handler))).resolves.toBe(true);
    await expect(
      guardFor({ isSuperuser: false, roles: [], permissions: [PlatformPermissions.MANAGE_AGENTS] }).canActivate(ctxFor(cls, handler))
    ).resolves.toBe(true);
  });

  it('every handler resolves the caller’s manage-agents scope and passes it with the inputs', async () => {
    const scope = { all: false, countries: ['CM'], states: [] };
    const geo = { require: jest.fn(async () => scope) };
    const service = {
      listAssignments: jest.fn(async () => ({ assignments: [], truncated: false })),
      coverage: jest.fn(async () => ({ locations: [] })),
      picker: jest.fn(async () => ({ agents: [] })),
      dismissRelation: jest.fn(async () => ({ changed: true })),
      listPostings: jest.fn(async () => ({ postings: [] })),
      closePosting: jest.fn(async () => ({ autoDeclined: 0 })),
      capability: jest.fn(async () => ({ enabled: true, countries: ['CM'] })),
      searchLocations: jest.fn(async () => ({ locations: [], truncated: false })),
      locationPickupSlots: jest.fn(async () => ({ slots: [] })),
    };
    const views = new DedicatedAdminViewsController(service as unknown as DedicatedAdminViewsService, geo as unknown as GeoScopeService);
    const posts = new DedicatedAdminPostingsController(service as unknown as DedicatedAdminViewsService, geo as unknown as GeoScopeService);
    const req = { user: { id: 'u-admin' } };
    await views.list('Douala', 'loc-1', 'morning', 'active', 'posting');
    await views.coverage('Douala');
    await views.picker('loc-1');
    await expect(views.dismissRelation('as-1', req)).resolves.toEqual({ success: true, changed: true });
    await posts.list('Douala', 'open');
    await posts.close('p-1', { reason: 'policy' }, req);
    await expect(views.searchLocations('mama', 'Douala', '10')).resolves.toEqual({ success: true, locations: [], truncated: false });
    await expect(views.locationPickupSlots('loc-1')).resolves.toEqual({ success: true, slots: [] });
    await expect(views.capability()).resolves.toEqual({ success: true, enabled: true, countries: ['CM'] });
    expect(service.capability).toHaveBeenCalledWith(scope);
    expect(geo.require).toHaveBeenCalledTimes(9);
    expect(service.searchLocations).toHaveBeenCalledWith(scope, { q: 'mama', city: 'Douala', limit: '10' });
    expect(service.locationPickupSlots).toHaveBeenCalledWith(scope, 'loc-1');
    expect(geo.require.mock.calls.every((c) => (c as unknown[])[0] === PlatformPermissions.MANAGE_AGENTS)).toBe(true);
    expect(service.listAssignments).toHaveBeenCalledWith(scope, { city: 'Douala', locationId: 'loc-1', slotKey: 'morning', status: 'active', source: 'posting' });
    expect(service.coverage).toHaveBeenCalledWith(scope, { city: 'Douala' });
    expect(service.picker).toHaveBeenCalledWith(scope, 'loc-1');
    expect(service.dismissRelation).toHaveBeenCalledWith(scope, 'u-admin', 'as-1');
    expect(service.listPostings).toHaveBeenCalledWith(scope, { city: 'Douala', status: 'open' });
    expect(service.closePosting).toHaveBeenCalledWith(scope, 'u-admin', 'p-1', 'policy');
  });
});

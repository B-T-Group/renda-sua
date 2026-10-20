import { NotFoundException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import type { PermissionService } from '../auth/permission.service';
import type { HasuraUserService } from '../hasura/hasura-user.service';
import type { GeoScopeService } from '../rbac/geo-scope.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import type { RbacService } from '../rbac/rbac.service';
import { DedicatedAgentsAdminController } from './dedicated-agents-admin.controller';
import type { DedicatedAssignmentsService } from './dedicated-assignments.service';

type Handler = 'assign' | 'setStatus' | 'remove';

function guardFor(access: { isSuperuser: boolean; roles: string[]; permissions: string[] }) {
  const users = { getUser: jest.fn(async () => ({ id: 'u-1' })) } as unknown as HasuraUserService;
  const rbac = { getEffectiveAccess: jest.fn(async () => access) } as unknown as RbacService;
  const perms = { isBusinessAdmin: jest.fn(async () => true) } as unknown as PermissionService;
  return new AdminAuthGuard(new Reflector(), users, perms, rbac);
}

function ctxFor(handler: Handler): ExecutionContext {
  return {
    getHandler: () => DedicatedAgentsAdminController.prototype[handler],
    getClass: () => DedicatedAgentsAdminController,
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('DedicatedAgentsAdminController', () => {
  it('is behind AdminAuthGuard on every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DedicatedAgentsAdminController)).toContain(AdminAuthGuard);
  });

  it.each<Handler>(['assign', 'setStatus', 'remove'])(
    '%s: a non-super user without platform.manage.agents is denied, even with another admin role',
    async (handler) => {
      const guard = guardFor({ isSuperuser: false, roles: ['support'], permissions: ['platform.users.read'] });
      await expect(guard.canActivate(ctxFor(handler))).rejects.toBeInstanceOf(UnauthorizedException);
    }
  );

  it.each<Handler>(['assign', 'setStatus', 'remove'])('%s: superuser or platform.manage.agents passes', async (handler) => {
    await expect(guardFor({ isSuperuser: true, roles: [], permissions: [] }).canActivate(ctxFor(handler))).resolves.toBe(true);
    await expect(
      guardFor({ isSuperuser: false, roles: [], permissions: [PlatformPermissions.MANAGE_AGENTS] }).canActivate(ctxFor(handler))
    ).resolves.toBe(true);
  });

  describe('geo scope', () => {
    const setup = (inScope: { businesses: string[]; agents: string[] }) => {
      const service = {
        locationBusinessId: jest.fn(async (id: string) => (id === 'loc-1' ? 'biz-1' : 'biz-2')),
        assignmentScope: jest.fn(async () => ({ businessId: 'biz-2', agentId: 'ag-2' })),
        superUserAssign: jest.fn(async () => ({ assignments: [] })),
        setPaused: jest.fn(async () => ({})),
        remove: jest.fn(async () => ({})),
      };
      const geo = {
        require: jest.fn(async () => ({ all: false })),
        assertBusiness: jest.fn(async (_s: unknown, id: string) => {
          if (!inScope.businesses.includes(id)) throw new NotFoundException('Business not found');
        }),
        assertAgent: jest.fn(async (_s: unknown, id: string) => {
          if (!inScope.agents.includes(id)) throw new NotFoundException('Agent not found');
        }),
      };
      const controller = new DedicatedAgentsAdminController(
        service as unknown as DedicatedAssignmentsService,
        geo as unknown as GeoScopeService
      );
      return { controller, service, geo };
    };
    const req = { user: { id: 'u-admin' } };
    const body = { locationId: 'loc-1', agentId: 'ag-1', slotKeys: ['morning'] };

    it('assigns when both the store and the agent are in scope, as the acting admin', async () => {
      const { controller, service, geo } = setup({ businesses: ['biz-1'], agents: ['ag-1'] });
      await controller.assign(body, req);
      expect(geo.require).toHaveBeenCalledWith(PlatformPermissions.MANAGE_AGENTS);
      expect(service.superUserAssign).toHaveBeenCalledWith({
        actorUserId: 'u-admin',
        locationId: 'loc-1',
        agentId: 'ag-1',
        slotKeys: ['morning'],
      });
    });

    it('a store or an agent outside the admin’s scope is 404 and nothing is written', async () => {
      const a = setup({ businesses: [], agents: ['ag-1'] });
      await expect(a.controller.assign(body, req)).rejects.toBeInstanceOf(NotFoundException);
      expect(a.service.superUserAssign).not.toHaveBeenCalled();
      const b = setup({ businesses: ['biz-1'], agents: [] });
      await expect(b.controller.assign(body, req)).rejects.toBeInstanceOf(NotFoundException);
      expect(b.service.superUserAssign).not.toHaveBeenCalled();
    });

    it('pause / remove check the assignment’s store against the scope', async () => {
      const out = setup({ businesses: ['biz-1'], agents: [] });
      await expect(out.controller.setStatus('as-1', { status: 'paused' }, req)).rejects.toBeInstanceOf(NotFoundException);
      await expect(out.controller.remove('as-1', { reason: 'x' }, req)).rejects.toBeInstanceOf(NotFoundException);
      expect(out.service.setPaused).not.toHaveBeenCalled();
      expect(out.service.remove).not.toHaveBeenCalled();

      const ok = setup({ businesses: ['biz-2'], agents: [] });
      await ok.controller.setStatus('as-1', { status: 'paused' }, req);
      await ok.controller.remove('as-1', { reason: 'x' }, req);
      expect(ok.service.setPaused).toHaveBeenCalledWith({ userId: 'u-admin' }, 'as-1', true);
      expect(ok.service.remove).toHaveBeenCalledWith({ userId: 'u-admin' }, 'as-1', 'x');
    });

    it('rejects a bad status before touching anything', async () => {
      const { controller, service } = setup({ businesses: ['biz-2'], agents: [] });
      await expect(controller.setStatus('as-1', { status: 'removed' as 'paused' }, req)).rejects.toThrow(/status/);
      expect(service.assignmentScope).not.toHaveBeenCalled();
    });
  });
});

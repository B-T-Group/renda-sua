import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../auth/permission.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';
import { AdminAuthGuard } from './admin-auth.guard';

const USER = { id: '11111111-1111-4111-8111-111111111111' };

function createContext() {
  const request: { user?: unknown } = {};
  const context = {
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AdminAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let hasuraUserService: { getUser: jest.Mock };
  let permissionService: { isBusinessAdmin: jest.Mock };
  let rbacService: { getEffectiveAccess: jest.Mock };
  let guard: AdminAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue([]) };
    hasuraUserService = { getUser: jest.fn().mockResolvedValue(USER) };
    permissionService = { isBusinessAdmin: jest.fn() };
    rbacService = { getEffectiveAccess: jest.fn() };
    guard = new AdminAuthGuard(
      reflector as unknown as Reflector,
      hasuraUserService as unknown as HasuraUserService,
      permissionService as unknown as PermissionService,
      rbacService as unknown as RbacService
    );
  });

  it('denies decorated routes without the required RBAC permission', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PERMISSIONS_KEY
        ? [PlatformPermissions.FINANCIAL_REFUNDS]
        : []
    );
    rbacService.getEffectiveAccess.mockResolvedValue({
      roles: [],
      permissions: [PlatformPermissions.MODERATE_ITEMS],
      isSuperuser: false,
    });

    const { context, request } = createContext();
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException(
        'Access denied. Required privileges missing.'
      )
    );
    expect(permissionService.isBusinessAdmin).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
  });

  it('allows superusers through permission-decorated routes', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === PERMISSIONS_KEY
        ? [PlatformPermissions.FINANCIAL_REFUNDS]
        : key === ROLES_KEY
        ? []
        : undefined
    );
    rbacService.getEffectiveAccess.mockResolvedValue({
      roles: ['superuser'],
      permissions: ['*'],
      isSuperuser: true,
    });

    const { context, request } = createContext();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(USER);
    expect(permissionService.isBusinessAdmin).not.toHaveBeenCalled();
  });

  it('allows assigned RBAC users through undecorated admin routes', async () => {
    permissionService.isBusinessAdmin.mockResolvedValue(false);
    rbacService.getEffectiveAccess.mockResolvedValue({
      roles: ['finance'],
      permissions: [PlatformPermissions.FINANCIAL_REFUNDS],
      isSuperuser: false,
    });

    const { context, request } = createContext();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBe(USER);
  });
});

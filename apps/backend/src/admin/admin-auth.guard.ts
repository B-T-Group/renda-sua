import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../auth/permission.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import {
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../rbac/permissions.decorator';
import { RbacService } from '../rbac/rbac.service';

/**
 * Gate for platform admin routes.
 * - If @RequirePermissions / @RequireRoles is set: enforce those (superuser passes).
 * - Otherwise: require superuser role OR any assigned platform role/permission.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly hasuraUserService: HasuraUserService,
    private readonly permissionService: PermissionService,
    private readonly rbacService: RbacService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user?.id) {
        throw new UnauthorizedException('User not authenticated');
      }

      const permissions =
        this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
          context.getHandler(),
          context.getClass(),
        ]) ?? [];
      const roles =
        this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
          context.getHandler(),
          context.getClass(),
        ]) ?? [];

      if (permissions.length || roles.length) {
        const access = await this.rbacService.getEffectiveAccess(user.id);
        if (access.isSuperuser) {
          (context.switchToHttp().getRequest() as { user?: unknown }).user =
            user;
          return true;
        }
        const roleOk = roles.some((r) => access.roles.includes(r));
        const permOk = permissions.some((p) =>
          access.permissions.includes(p)
        );
        if (!roleOk && !permOk) {
          throw new UnauthorizedException(
            'Access denied. Required privileges missing.'
          );
        }
        (context.switchToHttp().getRequest() as { user?: unknown }).user =
          user;
        return true;
      }

      const isAdmin = await this.permissionService.isBusinessAdmin(user.id);
      if (!isAdmin) {
        const access = await this.rbacService.getEffectiveAccess(user.id);
        if (!access.roles.length && !access.permissions.length) {
          throw new UnauthorizedException(
            'Access denied. Admin privileges required.'
          );
        }
      }

      (context.switchToHttp().getRequest() as { user?: unknown }).user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

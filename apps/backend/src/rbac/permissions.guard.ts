import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PERMISSIONS_KEY, ROLES_KEY } from './permissions.decorator';
import { RbacService } from './rbac.service';

/**
 * Enforces @RequirePermissions and/or @RequireRoles.
 * If neither is set, allows (pair with AdminAuthGuard during migration).
 * Superuser passes any requirement.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly hasuraUserService: HasuraUserService,
    private readonly rbacService: RbacService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    if (!permissions.length && !roles.length) {
      return true;
    }

    // Identity comes from RequestContext CLS populated by request middleware.
    const user = await this.hasuraUserService.getUser();
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const access = await this.rbacService.getEffectiveAccess(user.id);
    if (access.isSuperuser) {
      (context.switchToHttp().getRequest() as { user?: unknown }).user = user;
      return true;
    }

    const roleOk =
      roles.length > 0 && roles.some((role) => access.roles.includes(role));
    const permOk =
      permissions.length > 0 &&
      permissions.some((key) => access.permissions.includes(key));

    if (roleOk || permOk) {
      (context.switchToHttp().getRequest() as { user?: unknown }).user = user;
      return true;
    }

    throw new UnauthorizedException(
      'Access denied. Required privileges missing.'
    );
  }
}

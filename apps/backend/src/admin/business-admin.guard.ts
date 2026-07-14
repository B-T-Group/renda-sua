import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { isActivePersona, userHasPersona } from '../users/persona.util';

@Injectable()
export class BusinessAdminGuard implements CanActivate {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly permissionService: PermissionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const user = await this.hasuraUserService.getUser();
      if (!user?.id) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (
        !isActivePersona(user, 'business') &&
        !userHasPersona(user, 'business')
      ) {
        throw new ForbiddenException(
          'Only business users can access admin APIs'
        );
      }
      const isAdmin = await this.permissionService.isBusinessAdmin(user.id);
      if (!isAdmin) {
        throw new ForbiddenException('Admin privileges required');
      }
      (context.switchToHttp().getRequest() as { user?: unknown }).user = user;
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Unauthorized');
    }
  }
}

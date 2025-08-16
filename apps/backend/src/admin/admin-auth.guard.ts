import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly permissionService: PermissionService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      // Get user from request
      const user = await this.hasuraUserService.getUser();

      if (!user) {
        throw new UnauthorizedException('User not authenticated');
      }

      // Verify user is a business admin
      const isAdmin = await this.permissionService.isBusinessAdmin(user.id);

      if (!isAdmin) {
        throw new UnauthorizedException(
          'Access denied. Admin privileges required.'
        );
      }

      // Add user info to request for use in controllers
      request.user = user;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

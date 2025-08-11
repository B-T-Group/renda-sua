import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { HasuraUserService } from '../hasura/hasura-user.service';

@Injectable()
export class BusinessAdminGuard implements CanActivate {
  constructor(private readonly hasuraUserService: HasuraUserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const user = await this.hasuraUserService.getUser();
      const isBusiness = user.user_type_id === 'business' && user.business;
      if (!isBusiness) {
        throw new ForbiddenException(
          'Only business users can access admin APIs'
        );
      }
      if (!user.business?.is_admin) {
        throw new ForbiddenException('Admin privileges required');
      }
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new UnauthorizedException('Unauthorized');
    }
  }
}

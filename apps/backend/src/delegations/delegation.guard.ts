import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { DelegationAccessService } from './delegation-access.service';
import { LocationDelegationsFlagService } from './location-delegations-flag.service';
import { DELEGATION_PERMISSIONS_KEY } from './require-delegation-permissions.decorator';
import type { DelegationAccessContext } from './delegation.types';

@Injectable()
export class DelegationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flag: LocationDelegationsFlagService,
    private readonly access: DelegationAccessService,
    private readonly hasuraUser: HasuraUserService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.flag.isEnabled())) {
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    }
    const required =
      this.reflector.getAllAndOverride<string[]>(DELEGATION_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<{
      delegation?: DelegationAccessContext;
    }>();
    const ctx = this.hasuraUser.resolveContext();
    const userId = ctx.userId;
    const delegationId = ctx.activeDelegation?.trim();
    if (!userId || userId === 'anonymous' || !delegationId) {
      throw new HttpException(
        'X-Active-Delegation is required',
        HttpStatus.FORBIDDEN
      );
    }
    const resolved = await this.access.resolve(userId, delegationId);
    await this.access.assertHasPermission(resolved, required);
    request.delegation = resolved;
    return true;
  }
}

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PermissionService } from '../auth/permission.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { PlatformPermissions } from '../rbac/platform-permissions';

export interface BusinessItemsAccessContext {
  targetBusinessId: string;
  isPlatformAdmin: boolean;
  isOwnBusiness: boolean;
  ownBusinessId: string;
}

@Injectable()
export class BusinessItemsAccessService {
  constructor(
    private readonly hasuraUserService: HasuraUserService,
    private readonly permissionService: PermissionService
  ) {}

  async resolveAccess(
    requestedBusinessId?: string
  ): Promise<BusinessItemsAccessContext> {
    const user = await this.hasuraUserService.getUser();
    const ownBusinessId = user?.business?.id;
    if (!ownBusinessId) {
      throw new HttpException(
        { success: false, error: 'User has no business' },
        HttpStatus.FORBIDDEN
      );
    }

    const isPlatformAdmin = await this.permissionService.hasPlatformPermission(
      user.id,
      PlatformPermissions.CATALOG_CROSS_BUSINESS
    );
    const targetBusinessId = requestedBusinessId ?? ownBusinessId;
    const isOwnBusiness = targetBusinessId === ownBusinessId;

    if (!isOwnBusiness) {
      await this.assertCrossBusinessAccess(user.id, isPlatformAdmin, targetBusinessId);
    }

    return { targetBusinessId, isPlatformAdmin, isOwnBusiness, ownBusinessId };
  }

  assertCanDelete(ctx: BusinessItemsAccessContext): void {
    if (ctx.isPlatformAdmin && !ctx.isOwnBusiness) {
      throw new HttpException(
        {
          success: false,
          error: 'Admins cannot delete items for other businesses',
        },
        HttpStatus.FORBIDDEN
      );
    }
  }

  assertPlatformAdmin(ctx: BusinessItemsAccessContext): void {
    if (!ctx.isPlatformAdmin) {
      throw new HttpException(
        { success: false, error: 'Platform admin required' },
        HttpStatus.FORBIDDEN
      );
    }
  }

  private async assertCrossBusinessAccess(
    userId: string,
    isPlatformAdmin: boolean,
    targetBusinessId: string
  ): Promise<void> {
    if (!isPlatformAdmin) {
      throw new HttpException(
        { success: false, error: 'Forbidden' },
        HttpStatus.FORBIDDEN
      );
    }
    const canAccess = await this.permissionService.canAccessBusinessData(
      userId,
      targetBusinessId
    );
    if (!canAccess) {
      throw new HttpException(
        { success: false, error: 'Forbidden' },
        HttpStatus.FORBIDDEN
      );
    }
  }
}

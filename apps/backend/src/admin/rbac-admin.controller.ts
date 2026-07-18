import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';

@ApiTags('admin-rbac')
@Controller('admin/rbac')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class RbacAdminController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly hasuraUserService: HasuraUserService,
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly adminService: AdminService
  ) {}

  @Get('roles')
  @RequirePermissions(PlatformPermissions.RBAC_MANAGE)
  @ApiOperation({ summary: 'List platform roles' })
  @ApiResponse({ status: 200, description: 'Roles listed' })
  async listRoles() {
    return { success: true, roles: await this.rbacService.listRoles() };
  }

  @Get('permissions')
  @RequirePermissions(PlatformPermissions.RBAC_MANAGE)
  @ApiOperation({ summary: 'List platform permissions' })
  @ApiResponse({ status: 200, description: 'Permissions listed' })
  async listPermissions() {
    return {
      success: true,
      permissions: await this.rbacService.listPermissions(),
    };
  }

  @Get('users')
  @RequirePermissions(PlatformPermissions.RBAC_MANAGE)
  @ApiOperation({ summary: 'List users that have platform roles' })
  @ApiResponse({ status: 200, description: 'Users with roles listed' })
  async listUsersWithRoles() {
    return {
      success: true,
      users: await this.rbacService.listUsersWithRoles(),
    };
  }

  @Get('users/:userId/roles')
  @RequirePermissions(PlatformPermissions.RBAC_MANAGE)
  @ApiOperation({ summary: 'Get roles for a user' })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({ status: 200, description: 'User roles returned' })
  async getUserRoles(@Param('userId') userId: string) {
    return {
      success: true,
      roles: await this.rbacService.getUserRoleKeys(userId),
    };
  }

  @Put('users/:userId/roles')
  @RequirePermissions(PlatformPermissions.RBAC_MANAGE)
  @ApiOperation({ summary: 'Replace platform roles for a user' })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        roles: { type: 'array', items: { type: 'string' } },
      },
      required: ['roles'],
    },
  })
  @ApiResponse({ status: 200, description: 'Roles updated' })
  @ApiResponse({ status: 400, description: 'Invalid roles' })
  async setUserRoles(
    @ReqContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() body: { roles: string[] }
  ) {
    try {
      const granter = await this.hasuraUserService.getUser(ctx);
      const roles = await this.rbacService.setUserRoles(
        userId,
        body?.roles ?? [],
        granter?.id ?? null
      );
      if (roles.includes('superuser')) {
        const biz = await this.hasuraSystemService.executeQuery(
          `query BizByUser($userId: uuid!) {
            businesses(where: { user_id: { _eq: $userId } }, limit: 1) { id }
          }`,
          { userId }
        );
        const businessId = biz?.businesses?.[0]?.id as string | undefined;
        if (businessId) {
          await this.adminService.ensureSuperUserAiTokensForBusiness(
            businessId
          );
        }
      }
      return { success: true, roles };
    } catch (error: any) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to set roles' },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}

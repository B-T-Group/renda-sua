import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
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
import { RequirePermissions, RequireRoles } from '../rbac/permissions.decorator';
import { PlatformPermissions, PlatformRoles } from '../rbac/platform-permissions';
import { RbacService } from '../rbac/rbac.service';
import { ScopedRolesService } from '../rbac/scoped-roles.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { ReqContext } from '../auth/req-context.decorator';
import type { RequestContext } from '../auth/request-context';
import {
  LookupUserQueryDto,
  SetScopedRolesDto,
} from './dto/scoped-roles.dto';

@ApiTags('admin-rbac')
@Controller('admin/rbac')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class RbacAdminController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly scopedRoles: ScopedRolesService,
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

  @Get('country-admins')
  @RequireRoles(PlatformRoles.SUPERUSER)
  @ApiOperation({ summary: 'List country admins and their geographic grants' })
  @ApiResponse({ status: 200, description: 'Country admins listed' })
  async listCountryAdmins() {
    return { success: true, users: await this.scopedRoles.listCountryAdmins() };
  }

  @Get('markets')
  @RequireRoles(PlatformRoles.SUPERUSER)
  @ApiOperation({ summary: 'Countries and states available for scoped roles' })
  @ApiResponse({ status: 200, description: 'Markets listed' })
  async listMarkets() {
    return { success: true, markets: await this.scopedRoles.listMarkets() };
  }

  @Get('users/lookup')
  @RequireRoles(PlatformRoles.SUPERUSER)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Find a user by email for a scoped role assignment' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async lookupUser(@Query() query: LookupUserQueryDto) {
    return { success: true, user: await this.scopedRoles.lookupByEmail(query.email) };
  }

  @Put('users/:userId/scoped-roles')
  @RequireRoles(PlatformRoles.SUPERUSER)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Replace country and state role grants for a user' })
  @ApiParam({ name: 'userId', type: String })
  @ApiBody({ type: SetScopedRolesDto })
  @ApiResponse({ status: 200, description: 'Scoped roles updated' })
  @ApiResponse({ status: 400, description: 'Invalid grant' })
  async setScopedRoles(
    @ReqContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() body: SetScopedRolesDto
  ) {
    try {
      const granter = await this.hasuraUserService.getUser(ctx);
      const grants = await this.scopedRoles.setScopedRoles(
        userId,
        body.grants ?? [],
        granter?.id ?? null
      );
      return { success: true, grants };
    } catch (error: any) {
      throw new HttpException(
        { success: false, message: error.message || 'Failed to set scoped roles' },
        HttpStatus.BAD_REQUEST
      );
    }
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

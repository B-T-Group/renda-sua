import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { GeoScopeService } from '../rbac/geo-scope.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { DedicatedAdminViewsService } from './dedicated-admin-views.service';

interface RequestWithUser {
  user: { id: string };
}

/**
 * #594 PR 8 super-user views (AC-S1, S2 picker, S4, S5). `platform.manage.agents`
 * (superuser always passes), rows limited to the caller's geo scope and to
 * countries with `dedicated_agents_enabled` on.
 */
@ApiTags('admin-dedicated-agents')
@Controller('admin/dedicated-agents')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.MANAGE_AGENTS)
@ApiBearerAuth()
export class DedicatedAdminViewsController {
  constructor(private readonly service: DedicatedAdminViewsService, private readonly geo: GeoScopeService) {}

  @Get()
  @ApiOperation({ summary: 'Dedicated assignments with the possible-relation badge (S1, S5)' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'slotKey', required: false, enum: ['morning', 'afternoon', 'evening'] })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'paused', 'removed'] })
  @ApiQuery({ name: 'source', required: false, enum: ['superuser_assign', 'posting'] })
  async list(
    @Query('city') city?: string,
    @Query('locationId') locationId?: string,
    @Query('slotKey') slotKey?: string,
    @Query('status') status?: string,
    @Query('source') source?: string
  ) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.listAssignments(scope, { city, locationId, slotKey, status, source })) };
  }

  @Get('coverage')
  @ApiOperation({ summary: 'Covered vs uncovered enabled slots per location; dedicated vs standard order share, 30 days (S4)' })
  @ApiQuery({ name: 'city', required: false })
  async coverage(@Query('city') city?: string) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.coverage(scope, { city })) };
  }

  @Get('picker')
  @ApiOperation({ summary: 'Internal agents and verified independents for a direct assign, with load and balance coverage (S2)' })
  @ApiQuery({ name: 'locationId', required: true })
  async picker(@Query('locationId') locationId: string) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.picker(scope, String(locationId ?? ''))) };
  }

  @Get('locations')
  @ApiOperation({ summary: '#594 G10: search locations (store / business name or city) in scope, flag-on countries only' })
  @ApiQuery({ name: 'q', required: true, description: 'At least 2 characters' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'limit', required: false, description: 'Default 20, max 50' })
  @ApiResponse({ status: 400, description: 'query_too_short' })
  async searchLocations(@Query('q') q?: string, @Query('city') city?: string, @Query('limit') limit?: string) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.searchLocations(scope, { q, city, limit })) };
  }

  @Get('locations/:locationId/pickup-slots')
  @ApiOperation({ summary: '#594 G11: pickup slots of a location (read-only, same payload as the owner endpoint)' })
  @ApiParam({ name: 'locationId' })
  @ApiResponse({ status: 404, description: 'Not found, out of scope, or flag off' })
  async locationPickupSlots(@Param('locationId') locationId: string) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.locationPickupSlots(scope, locationId)) };
  }

  @Post('assignments/:id/dismiss-relation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove the possible-relation badge (audited)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 404, description: 'Not found, out of scope, or flag off' })
  async dismissRelation(@Param('id') id: string, @Req() req: RequestWithUser) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.dismissRelation(scope, req.user.id, id)) };
  }
}

/** #594 PR 8 AC-S3: postings per city with Close. */
@ApiTags('admin-dedicated-agents')
@Controller('admin/dedicated-postings')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.MANAGE_AGENTS)
@ApiBearerAuth()
export class DedicatedAdminPostingsController {
  constructor(private readonly service: DedicatedAdminViewsService, private readonly geo: GeoScopeService) {}

  @Get()
  @ApiOperation({ summary: 'Dedicated postings, filterable by city and status' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'filled', 'closed', 'expired'] })
  async list(@Query('city') city?: string, @Query('status') status?: string) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.listPostings(scope, { city, status })) };
  }

  @Post(':postingId/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a posting (pending applicants auto-declined)' })
  @ApiParam({ name: 'postingId' })
  async close(@Param('postingId') postingId: string, @Body() body: { reason?: string }, @Req() req: RequestWithUser) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    return { success: true, ...(await this.service.closePosting(scope, req.user.id, postingId, body?.reason)) };
  }
}

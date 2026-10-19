import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { GeoScopeService } from '../rbac/geo-scope.service';
import { PlatformPermissions } from '../rbac/platform-permissions';
import { DedicatedAssignmentsService } from './dedicated-assignments.service';
import { parseAssignmentStatus } from './dedicated-assignments.dto';
import type {
  RemoveDedicatedAssignmentDto,
  SetDedicatedAssignmentStatusDto,
  SuperUserAssignDto,
} from './dedicated-assignments.dto';

interface RequestWithUser {
  user: { id: string };
}

/**
 * #594 super-user actions (AC-S2, AC-B17 remove). Platform admins with
 * `platform.manage.agents` (superuser always passes), limited to their geo
 * scope for both the store's business and the agent. Behind
 * `dedicated_agents_enabled` for the store's country (off -> 404).
 */
@ApiTags('admin-dedicated-agents')
@Controller('admin/dedicated-agents')
@UseGuards(AdminAuthGuard)
@RequirePermissions(PlatformPermissions.MANAGE_AGENTS)
@ApiBearerAuth()
export class DedicatedAgentsAdminController {
  constructor(
    private readonly service: DedicatedAssignmentsService,
    private readonly geo: GeoScopeService
  ) {}

  @Post('assignments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a dedicated agent to location slot(s); active immediately' })
  @ApiResponse({ status: 201, description: 'Assigned; business and agent notified' })
  @ApiResponse({ status: 409, description: 'Agent at assignment cap, already assigned, or slot off' })
  async assign(@Body() body: SuperUserAssignDto, @Req() req: RequestWithUser) {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    await this.geo.assertBusiness(scope, await this.service.locationBusinessId(String(body?.locationId ?? '')));
    await this.geo.assertAgent(scope, String(body?.agentId ?? ''));
    const result = await this.service.superUserAssign({
      actorUserId: req.user.id,
      locationId: String(body.locationId),
      agentId: String(body.agentId),
      slotKeys: body.slotKeys,
    });
    return { success: true, ...result };
  }

  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Pause or resume a dedicated assignment' })
  @ApiParam({ name: 'id' })
  async setStatus(
    @Param('id') id: string,
    @Body() body: SetDedicatedAssignmentStatusDto,
    @Req() req: RequestWithUser
  ) {
    const status = parseAssignmentStatus(body?.status);
    await this.assertScope(id);
    return { success: true, ...(await this.service.setPaused({ userId: req.user.id }, id, status === 'paused')) };
  }

  @Delete('assignments/:id')
  @ApiOperation({ summary: 'Remove a dedicated assignment' })
  @ApiParam({ name: 'id' })
  async remove(@Param('id') id: string, @Body() body: RemoveDedicatedAssignmentDto, @Req() req: RequestWithUser) {
    await this.assertScope(id);
    return { success: true, ...(await this.service.remove({ userId: req.user.id }, id, body?.reason)) };
  }

  private async assertScope(assignmentId: string): Promise<void> {
    const scope = await this.geo.require(PlatformPermissions.MANAGE_AGENTS);
    const { businessId } = await this.service.assignmentScope(assignmentId);
    await this.geo.assertBusiness(scope, businessId);
  }
}

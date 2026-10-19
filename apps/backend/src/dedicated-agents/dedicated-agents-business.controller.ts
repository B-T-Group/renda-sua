import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DedicatedAssignmentsService } from './dedicated-assignments.service';
import { parseAssignmentStatus } from './dedicated-assignments.dto';
import type {
  RemoveDedicatedAssignmentDto,
  SetDedicatedAssignmentStatusDto,
  UpdatePickupSlotsDto,
} from './dedicated-assignments.dto';
import { DedicatedLocationAccessService } from './dedicated-location-access.service';

/**
 * #594 business side: a location's dedicated agents (AC-B7, B17) and pickup
 * slots (AC-B1, B2, B4). Owner, or a delegate of this location with
 * `delegation.dedicated_agents.manage`. Behind `dedicated_agents_enabled`.
 */
@ApiTags('dedicated-agents')
@Controller('business-locations/:locationId')
@ApiBearerAuth()
export class DedicatedAgentsBusinessController {
  constructor(
    private readonly service: DedicatedAssignmentsService,
    private readonly access: DedicatedLocationAccessService
  ) {}

  @Get('dedicated-agents')
  @ApiOperation({ summary: 'Dedicated agent cards for this location' })
  @ApiParam({ name: 'locationId' })
  async list(@Param('locationId') locationId: string) {
    await this.access.resolve(locationId);
    return { success: true, ...(await this.service.listForLocation(locationId)) };
  }

  @Patch('dedicated-agents/:assignmentId')
  @ApiOperation({ summary: 'Pause or resume a dedicated agent' })
  @ApiResponse({ status: 403, description: 'Not the owner, or delegate without the manage permission' })
  async setStatus(
    @Param('locationId') locationId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: SetDedicatedAssignmentStatusDto
  ) {
    const status = parseAssignmentStatus(body?.status);
    const actor = await this.access.resolve(locationId);
    return {
      success: true,
      ...(await this.service.setPaused({ userId: actor.userId, locationId }, assignmentId, status === 'paused')),
    };
  }

  @Delete('dedicated-agents/:assignmentId')
  @ApiOperation({ summary: 'Remove a dedicated agent (does not reopen a posting)' })
  async remove(
    @Param('locationId') locationId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() body: RemoveDedicatedAssignmentDto
  ) {
    const actor = await this.access.resolve(locationId);
    return {
      success: true,
      ...(await this.service.remove({ userId: actor.userId, locationId }, assignmentId, body?.reason)),
    };
  }

  @Get('pickup-slots')
  @ApiOperation({ summary: 'Pickup slots (toggle + pickup time) for this location' })
  async pickupSlots(@Param('locationId') locationId: string) {
    await this.access.resolve(locationId);
    return { success: true, ...(await this.service.getPickupSlots(locationId)) };
  }

  @Patch('pickup-slots')
  @ApiOperation({ summary: 'Toggle pickup slots / set pickup times; turning a slot off pauses its agents' })
  @ApiResponse({ status: 409, description: 'Slot has active dedicated agents and confirmPauseAgents was not set' })
  async updatePickupSlots(@Param('locationId') locationId: string, @Body() body: UpdatePickupSlotsDto) {
    const actor = await this.access.resolve(locationId);
    return {
      success: true,
      ...(await this.service.updatePickupSlots(
        { userId: actor.userId, locationId },
        { slots: body?.slots, confirmPauseAgents: body?.confirmPauseAgents }
      )),
    };
  }
}

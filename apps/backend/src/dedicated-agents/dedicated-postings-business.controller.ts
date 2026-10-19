import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DedicatedLocationAccessService } from './dedicated-location-access.service';
import type {
  CloseDedicatedPostingDto,
  CreateDedicatedPostingDto,
  UpdateDedicatedPostingTermsDto,
} from './dedicated-postings.dto';
import { DedicatedPostingsService } from './dedicated-postings.service';

/**
 * #594 PR 7 business side of postings (AC-B11..B16, E8). Owner, or a delegate
 * of this location with `delegation.dedicated_agents.manage`. Behind
 * `dedicated_agents_enabled` for the location's country (off -> 404).
 */
@ApiTags('dedicated-agents')
@Controller('business-locations/:locationId/dedicated-postings')
@ApiBearerAuth()
export class DedicatedPostingsBusinessController {
  constructor(
    private readonly service: DedicatedPostingsService,
    private readonly access: DedicatedLocationAccessService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Post a dedicated-agent request (headcount, slots, days, terms)' })
  @ApiParam({ name: 'locationId' })
  @ApiResponse({ status: 400, description: 'invalid_headcount | invalid_slot_keys | invalid_days_of_week | terms_too_long' })
  @ApiResponse({ status: 409, description: 'posting_already_open (body.posting is the open one) | slot_disabled' })
  async create(@Param('locationId') locationId: string, @Body() body: CreateDedicatedPostingDto) {
    const actor = await this.access.resolve(locationId);
    return { success: true, ...(await this.service.create({ userId: actor.userId, locationId }, body ?? ({} as CreateDedicatedPostingDto))) };
  }

  @Get()
  @ApiOperation({ summary: 'Postings of this location (latest 20, with pending applicant counts)' })
  async list(@Param('locationId') locationId: string) {
    await this.access.resolve(locationId);
    return { success: true, ...(await this.service.list(locationId)) };
  }

  @Patch(':postingId')
  @ApiOperation({ summary: 'Edit the terms of an open posting; pending applicants are told (AC-A1c)' })
  @ApiResponse({ status: 409, description: 'posting_not_open | posting_filled' })
  async updateTerms(
    @Param('locationId') locationId: string,
    @Param('postingId') postingId: string,
    @Body() body: UpdateDedicatedPostingTermsDto
  ) {
    const actor = await this.access.resolve(locationId);
    return { success: true, ...(await this.service.updateTerms({ userId: actor.userId, locationId }, postingId, body?.terms)) };
  }

  @Post(':postingId/close')
  @HttpCode(200)
  @ApiOperation({ summary: 'Close a posting early; pending applicants are auto-declined' })
  async close(
    @Param('locationId') locationId: string,
    @Param('postingId') postingId: string,
    @Body() body: CloseDedicatedPostingDto
  ) {
    const actor = await this.access.resolve(locationId);
    return { success: true, ...(await this.service.close({ userId: actor.userId, locationId }, postingId, body?.reason)) };
  }

  @Get(':postingId/applications')
  @ApiOperation({ summary: 'Applicant cards (no phone until accepted)' })
  async applications(@Param('locationId') locationId: string, @Param('postingId') postingId: string) {
    await this.access.resolve(locationId);
    return { success: true, ...(await this.service.applications(locationId, postingId)) };
  }

  @Post(':postingId/applications/:applicationId/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept an applicant (one locked transaction); returns the agent phone' })
  @ApiResponse({
    status: 409,
    description:
      'posting_filled | posting_not_open | posting_expired | application_not_pending | agent_holds_slot | dedicated_agent_assignment_cap_exceeded',
  })
  async accept(
    @Param('locationId') locationId: string,
    @Param('postingId') postingId: string,
    @Param('applicationId') applicationId: string
  ) {
    const actor = await this.access.resolve(locationId);
    return { success: true, ...(await this.service.accept({ userId: actor.userId, locationId }, postingId, applicationId)) };
  }

  @Post(':postingId/applications/:applicationId/decline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Decline an applicant' })
  @ApiResponse({ status: 409, description: 'application_not_pending' })
  async decline(
    @Param('locationId') locationId: string,
    @Param('postingId') postingId: string,
    @Param('applicationId') applicationId: string
  ) {
    const actor = await this.access.resolve(locationId);
    return { success: true, ...(await this.service.decline({ userId: actor.userId, locationId }, postingId, applicationId)) };
  }
}

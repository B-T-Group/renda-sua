import { Controller, Get, HttpCode, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { DedicatedOpportunitiesService } from './dedicated-opportunities.service';

/** #594 PR 7 agent Opportunities tab (AC-A1..A4): list, one-tap apply, withdraw. */
@ApiTags('dedicated-agents')
@Controller('agents/me/dedicated-opportunities')
@ApiBearerAuth()
export class DedicatedOpportunitiesController {
  constructor(
    private readonly service: DedicatedOpportunitiesService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Open postings in the agent’s city (normalised city + state + country)' })
  @ApiResponse({
    status: 403,
    description: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE (reason: not_verified | contract_unsigned | suspended | internal_agent | no_address | ...)',
  })
  @ApiResponse({ status: 404, description: 'Flag off (no address: the global flag is off)' })
  async list() {
    return { success: true, ...(await this.service.list(this.requireUserId())) };
  }

  @Get(':postingId')
  @ApiOperation({ summary: '#594 G1: one posting (open in the agent’s city, or one the agent applied to)' })
  @ApiParam({ name: 'postingId' })
  @ApiResponse({ status: 403, description: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE (reason incl. internal_agent | no_address)' })
  @ApiResponse({ status: 404, description: 'Posting not found, not visible, or flag off' })
  async detail(@Param('postingId') postingId: string) {
    return { success: true, ...(await this.service.detail(this.requireUserId(), postingId)) };
  }

  @Post(':postingId/apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply (idempotent while applied)' })
  @ApiResponse({ status: 422, description: 'PROFILE_PHOTO_REQUIRED: show the add-photo step, then apply again' })
  @ApiResponse({ status: 409, description: 'posting_not_open | holds_slot | max_assignments | application_closed | cannot_apply_own_store' })
  async apply(@Param('postingId') postingId: string) {
    return { success: true, ...(await this.service.apply(this.requireUserId(), postingId)) };
  }

  @Post(':postingId/withdraw')
  @HttpCode(200)
  @ApiOperation({ summary: 'Withdraw a pending application' })
  @ApiResponse({ status: 409, description: 'application_not_pending' })
  async withdraw(@Param('postingId') postingId: string) {
    return { success: true, ...(await this.service.withdraw(this.requireUserId(), postingId)) };
  }

  private requireUserId(): string {
    return requireAuthedUserId(this.hasuraUserService);
  }
}

function requireAuthedUserId(hasuraUserService: HasuraUserService): string {
  const userId = hasuraUserService.getUserId();
  if (!userId || userId === 'anonymous') throw new UnauthorizedException('User not authenticated');
  return userId;
}

/** #594 G12: is dedicated agents on for the caller's country? Always 200 (never 404). */
@ApiTags('dedicated-agents')
@Controller()
@ApiBearerAuth()
export class DedicatedCapabilityController {
  constructor(
    private readonly service: DedicatedOpportunitiesService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('agents/me/dedicated-agents/capability')
  @ApiOperation({ summary: 'Flag for the agent’s address country: { enabled, country, reason: null | no_address }' })
  async forAgent() {
    return { success: true, ...(await this.service.capabilityForAgent(requireAuthedUserId(this.hasuraUserService))) };
  }

  @Get('dedicated-agents/capability')
  @ApiOperation({ summary: 'Flag for a country: { enabled, country, reason: null | no_country }' })
  @ApiQuery({ name: 'country', required: false })
  @ApiResponse({ status: 400, description: 'invalid_country' })
  async forCountry(@Query('country') country?: string) {
    requireAuthedUserId(this.hasuraUserService);
    return { success: true, ...(await this.service.capabilityForCountry(country)) };
  }
}


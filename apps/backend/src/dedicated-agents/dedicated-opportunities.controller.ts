import { Controller, Get, HttpCode, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiResponse({ status: 403, description: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE (reason: not_verified | contract_unsigned | suspended | ...)' })
  async list() {
    return { success: true, ...(await this.service.list(this.requireUserId())) };
  }

  @Post(':postingId/apply')
  @HttpCode(200)
  @ApiOperation({ summary: 'Apply (idempotent while applied)' })
  @ApiResponse({ status: 422, description: 'PROFILE_PHOTO_REQUIRED: show the add-photo step, then apply again' })
  @ApiResponse({ status: 409, description: 'posting_not_open | holds_slot | max_assignments | application_closed' })
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
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') throw new UnauthorizedException('User not authenticated');
    return userId;
  }
}

import { Controller, Get, Param, ParseUUIDPipe, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { DedicatedHeadsUpService } from './dedicated-heads-up.service';

/** Early dedicated heads-up, agent side: read it and answer "Can't take it". */
@ApiTags('dedicated-agents')
@Controller('agents/me/dedicated-heads-ups')
@ApiBearerAuth()
export class DedicatedHeadsUpController {
  constructor(
    private readonly service: DedicatedHeadsUpService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get(':orderId')
  @ApiOperation({ summary: "The agent's heads-up for an order (null when none)" })
  async get(@Param('orderId', new ParseUUIDPipe()) orderId: string) {
    return { success: true, headsUp: await this.service.getForAgent(this.requireUserId(), orderId) };
  }

  @Post(':orderId/unavailable')
  @ApiOperation({ summary: "Can't take it: skip this agent for the order's dedicated dispatch" })
  async unavailable(@Param('orderId', new ParseUUIDPipe()) orderId: string) {
    return { success: true, ...(await this.service.markUnavailable(this.requireUserId(), orderId)) };
  }

  private requireUserId(): string {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') throw new UnauthorizedException('User not authenticated');
    return userId;
  }
}

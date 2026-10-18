import { Body, Controller, Get, Param, Patch, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { DedicatedAssignmentsService } from './dedicated-assignments.service';
import type { SetOffTodayDto } from './dedicated-assignments.dto';

/** #594 agent side: My stores (AC-A5) and the Off today switch. */
@ApiTags('dedicated-agents')
@Controller('agents/me/dedicated-assignments')
@ApiBearerAuth()
export class DedicatedAgentsAgentController {
  constructor(
    private readonly service: DedicatedAssignmentsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get()
  @ApiOperation({ summary: 'My stores: the current agent’s dedicated assignments' })
  async mine() {
    return { success: true, ...(await this.service.listMine(this.requireUserId())) };
  }

  @Patch(':id/off-today')
  @ApiOperation({ summary: 'Off today for one assignment (resets the next local day)' })
  async offToday(@Param('id') id: string, @Body() body: SetOffTodayDto) {
    return { success: true, ...(await this.service.setOffToday(this.requireUserId(), id, body?.off)) };
  }

  private requireUserId(): string {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') throw new UnauthorizedException('User not authenticated');
    return userId;
  }
}

import { Body, Controller, Get, Param, Patch, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { AgentSlotPrefsService, type SlotPrefsUpdateInput } from './agent-slot-prefs.service';

/** #594 addendum: agent preferred delivery slots and the slot-off Resume. */
@ApiTags('dedicated-agents')
@Controller('agents/me')
@ApiBearerAuth()
export class AgentSlotPrefsController {
  constructor(
    private readonly service: AgentSlotPrefsService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  @Get('slot-preferences')
  @ApiOperation({ summary: 'Preferred delivery slots (morning / afternoon / evening)' })
  async get() {
    return { success: true, ...(await this.service.get(this.requireUserId())) };
  }

  @Patch('slot-preferences')
  @ApiOperation({
    summary: 'Set one or more slots. Turning a slot off with active dedicated assignments returns 409 until confirmPause=true',
  })
  async update(@Body() body: SlotPrefsUpdateInput) {
    return { success: true, ...(await this.service.update(this.requireUserId(), body ?? {})) };
  }

  @Patch('dedicated-assignments/:id/resume')
  @ApiOperation({ summary: 'Resume an assignment paused by turning its slot off (slot must be on)' })
  async resume(@Param('id') id: string) {
    return { success: true, ...(await this.service.resume(this.requireUserId(), id)) };
  }

  private requireUserId(): string {
    const userId = this.hasuraUserService.getUserId();
    if (!userId || userId === 'anonymous') throw new UnauthorizedException('User not authenticated');
    return userId;
  }
}

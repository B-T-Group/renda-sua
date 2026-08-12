import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AGENT_FOCUS_VALUES, type AgentFocus } from '../agent-focus.util';

export class UpdateAgentFocusDto {
  @ApiProperty({
    enum: AGENT_FOCUS_VALUES,
    description:
      'Whether this agent focuses on deliveries, recruiting businesses, or both.',
  })
  @IsIn(AGENT_FOCUS_VALUES)
  focus!: AgentFocus;
}

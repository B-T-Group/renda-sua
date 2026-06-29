import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateAgentAvailabilityDto {
  @ApiProperty({
    description:
      'Whether the agent is available for new orders. When false the agent is not notified of nearby orders.',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  available!: boolean;
}

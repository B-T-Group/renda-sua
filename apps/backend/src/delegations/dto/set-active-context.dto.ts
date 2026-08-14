import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetActiveContextDto {
  @ApiProperty({ enum: ['persona', 'delegation'] })
  kind!: 'persona' | 'delegation';

  @ApiPropertyOptional({ enum: ['client', 'agent', 'business'] })
  persona?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  delegationId?: string;
}

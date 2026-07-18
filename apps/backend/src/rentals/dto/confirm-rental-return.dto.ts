import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class ConfirmRentalReturnDto {
  @ApiPropertyOptional({
    description:
      'When the item was returned (ISO 8601). Defaults to now. Used for overtime math.',
    example: '2026-07-18T14:30:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  actualEndAt?: string;
}

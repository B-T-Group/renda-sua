import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class RentalRequestWindowDto {
  @ApiProperty({ description: 'Window start (ISO 8601)' })
  @IsISO8601()
  requestedStartAt!: string;

  @ApiProperty({ description: 'Window end (ISO 8601)' })
  @IsISO8601()
  requestedEndAt!: string;
}

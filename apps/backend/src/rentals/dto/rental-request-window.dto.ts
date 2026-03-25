import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

export class RentalRequestWindowDto {
  @ApiProperty({ description: 'Window start (ISO 8601)' })
  @IsISO8601()
  requestedStartAt!: string;

  @ApiProperty({ description: 'Window end (ISO 8601)' })
  @IsISO8601()
  requestedEndAt!: string;

  @ApiProperty({
    required: false,
    enum: ['hourly', 'all_day'],
    description: 'Defaults to hourly when omitted',
  })
  @IsOptional()
  @IsIn(['hourly', 'all_day'])
  billing?: 'hourly' | 'all_day';

  @ApiProperty({
    required: false,
    description: 'Calendar date YYYY-MM-DD; required when billing is all_day',
    example: '2025-03-25',
  })
  @ValidateIf((o) => o.billing === 'all_day')
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'calendarDate must be YYYY-MM-DD',
  })
  calendarDate?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SetDeclineExclusionDto {
  @ApiProperty({ description: 'True when support marks the decline as not the business fault' })
  @IsBoolean()
  excluded!: boolean;

  @ApiPropertyOptional({ description: 'Optional note. Cleared when the exclusion is reversed.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'The decline row. Required when the booking has more than one.' })
  @IsOptional()
  @IsUUID()
  declineId?: string;
}

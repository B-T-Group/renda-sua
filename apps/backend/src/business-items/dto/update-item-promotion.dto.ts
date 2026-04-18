import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional } from 'class-validator';

export class UpdateItemPromotionDto {
  @ApiProperty({ description: 'Whether the listing is promoted' })
  @IsBoolean()
  promoted!: boolean;

  @ApiProperty({
    required: false,
    description: 'Promotion window start (ISO 8601 UTC)',
  })
  @IsOptional()
  @IsISO8601()
  start?: string;

  @ApiProperty({
    required: false,
    description: 'Promotion window end (ISO 8601 UTC)',
  })
  @IsOptional()
  @IsISO8601()
  end?: string;

  @ApiProperty({
    required: false,
    description: 'Sponsored listing (stronger relevance boost)',
  })
  @IsOptional()
  @IsBoolean()
  sponsored?: boolean;
}

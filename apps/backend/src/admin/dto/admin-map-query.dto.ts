import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ADMIN_MAP_KINDS } from '../admin-map.types';
import type { AdminMapKind } from '../admin-map.types';

export class AdminMapPinsQueryDto {
  @ApiPropertyOptional({ example: 'CM', description: 'ISO country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({
    example: 'Littoral',
    description: 'Market region (supported_country_states.state_name)',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ enum: ADMIN_MAP_KINDS, default: 'all' })
  @IsOptional()
  @IsIn(ADMIN_MAP_KINDS)
  kind?: AdminMapKind;
}

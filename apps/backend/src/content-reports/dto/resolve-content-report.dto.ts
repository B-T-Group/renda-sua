import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const RESOLVE_ACTIONS = ['dismiss', 'hide_content', 'warn_merchant'] as const;

export type ResolveContentReportAction = (typeof RESOLVE_ACTIONS)[number];

export class ResolveContentReportDto {
  @ApiProperty({ enum: RESOLVE_ACTIONS })
  @IsEnum(RESOLVE_ACTIONS)
  action!: ResolveContentReportAction;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;
}

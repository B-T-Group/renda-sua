import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class AdminPerformanceSummaryQueryDto {
  @ApiProperty({ description: 'ISO date/time, inclusive lower bound' })
  @IsDateString()
  from!: string;

  @ApiProperty({ description: 'ISO date/time, inclusive upper bound' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-2 market filter (e.g. CM, GA, CA)',
    example: 'CM',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;
}

export const TOP_AGENT_METRICS = ['deliveries', 'business_referrals'] as const;
export type TopAgentMetric = (typeof TOP_AGENT_METRICS)[number];

export class AdminPerformanceTopAgentsQueryDto extends AdminPerformanceSummaryQueryDto {
  @ApiProperty({ enum: TOP_AGENT_METRICS })
  @IsIn(TOP_AGENT_METRICS)
  metric!: TopAgentMetric;

  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

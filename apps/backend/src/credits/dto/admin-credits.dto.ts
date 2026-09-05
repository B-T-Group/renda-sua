import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CREDIT_CONTACT_CHANNELS,
  CREDIT_EVENT_TYPES,
  CREDIT_FEEDBACK_ACTIONS,
  CREDIT_ORDER_RESULTS,
} from '../credit.types';

const COUNTRY_CODE_PATTERN = /^[A-Za-z]{2}$/;

export class AdminCreditsListQueryDto {
  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: CREDIT_EVENT_TYPES })
  @IsOptional()
  @IsIn([...CREDIT_EVENT_TYPES])
  eventType?: (typeof CREDIT_EVENT_TYPES)[number];

  @ApiPropertyOptional({
    description: 'ISO alpha-2 country filter (credited user)',
    example: 'CM',
  })
  @IsOptional()
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  country?: string;
}

export class AdminCreditsSummaryQueryDto {
  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ enum: CREDIT_EVENT_TYPES })
  @IsOptional()
  @IsIn([...CREDIT_EVENT_TYPES])
  eventType?: (typeof CREDIT_EVENT_TYPES)[number];

  @ApiPropertyOptional({
    description: 'ISO alpha-2 country filter (credited user)',
    example: 'CM',
  })
  @IsOptional()
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  country?: string;
}

export class AdminCreditsQueueQueryDto {
  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'ISO alpha-2 country filter (order client)',
    example: 'CM',
  })
  @IsOptional()
  @IsString()
  @Matches(COUNTRY_CODE_PATTERN)
  country?: string;
}

export class ResolveEscalationCreditDto {
  @ApiProperty({ enum: CREDIT_CONTACT_CHANNELS })
  @IsIn([...CREDIT_CONTACT_CHANNELS])
  contact_channel!: (typeof CREDIT_CONTACT_CHANNELS)[number];

  @ApiProperty({ enum: CREDIT_ORDER_RESULTS })
  @IsIn([...CREDIT_ORDER_RESULTS])
  order_result!: (typeof CREDIT_ORDER_RESULTS)[number];

  @ApiProperty({ description: 'Comments about the resolution' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  notes!: string;
}

export class OrderFeedbackCreditDto {
  @ApiProperty({ enum: CREDIT_FEEDBACK_ACTIONS })
  @IsIn([...CREDIT_FEEDBACK_ACTIONS])
  action!: (typeof CREDIT_FEEDBACK_ACTIONS)[number];

  @ApiProperty({ description: 'Call-back feedback notes' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  notes!: string;
}

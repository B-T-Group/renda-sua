import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export const REFERRAL_REVIEW_QUEUE_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'all',
] as const;

export type ReferralReviewQueueStatus =
  (typeof REFERRAL_REVIEW_QUEUE_STATUSES)[number];

export class BusinessReferralReviewQueueQueryDto {
  @ApiPropertyOptional({
    enum: REFERRAL_REVIEW_QUEUE_STATUSES,
    default: 'pending',
  })
  @IsOptional()
  @IsIn(REFERRAL_REVIEW_QUEUE_STATUSES)
  status?: ReferralReviewQueueStatus = 'pending';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class ReferralReviewItemMarkDto {
  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty({ enum: ['good', 'bad'] })
  @IsIn(['good', 'bad'])
  quality!: 'good' | 'bad';
}

export class SubmitBusinessReferralReviewDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision!: 'approve' | 'reject';

  @ApiPropertyOptional({
    description: 'Required when decision is reject',
    maxLength: 8000,
  })
  @ValidateIf((o) => o.decision === 'reject')
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  rejectionReason?: string;

  @ApiPropertyOptional({ type: [ReferralReviewItemMarkDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReferralReviewItemMarkDto)
  itemMarks?: ReferralReviewItemMarkDto[];
}

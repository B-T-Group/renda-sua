import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ITEM_CONDITIONS, REJECTION_CATEGORIES } from '../item-recovery.constants';
import type { ItemCondition, RejectionCategory } from '../item-recovery.constants';

/** Lengths are enforced in the service so clients get coded errors, not class-validator text. */
export class CreateItemAppealDto {
  @ApiProperty({ minLength: 20, maxLength: 500 })
  @IsString()
  reason!: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: 3,
    description: 'evidenceUrl values returned by POST items/:itemId/appeal-evidence/upload-url for this item',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceUrls?: string[];
}

/** Type/size are enforced in the service (coded errors); class-validator only checks shape. */
export class AppealEvidenceUploadUrlDto {
  @ApiProperty({ enum: ['image/jpeg', 'image/png', 'image/webp'] })
  @IsString()
  contentType!: string;

  @ApiProperty({ description: 'Exact byte size of the file; signed into the URL (max 5 MB)' })
  @IsInt()
  fileSize!: number;
}

export class ResubmitItemDto {
  @ApiPropertyOptional({ description: 'Required (true) when an appeal is pending; it will be withdrawn.' })
  @IsOptional()
  @IsBoolean()
  confirmWithdrawAppeal?: boolean;
}

export class SetItemConditionDto {
  @ApiProperty({ enum: ITEM_CONDITIONS })
  @IsIn(ITEM_CONDITIONS as unknown as string[])
  condition!: ItemCondition;

  @ApiPropertyOptional({ description: 'Required (10–300 chars) unless condition = new' })
  @IsOptional()
  @IsString()
  wearNote?: string | null;
}

export class AiCleanupQuoteQueryDto {
  @ApiProperty({ minimum: 1, maximum: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  imageCount!: number;
}

export class AppealsQueueQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'upheld', 'overturned', 'withdrawn'] })
  @IsOptional()
  @IsIn(['pending', 'upheld', 'overturned', 'withdrawn'])
  status?: string;

  @ApiPropertyOptional({ enum: REJECTION_CATEGORIES })
  @IsOptional()
  @IsIn(REJECTION_CATEGORIES as unknown as string[])
  category?: RejectionCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  businessId?: string;

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
}

export class DecideItemAppealDto {
  @ApiProperty({ enum: ['uphold', 'overturn'] })
  @IsIn(['uphold', 'overturn'])
  decision!: 'uphold' | 'overturn';

  @ApiPropertyOptional({ description: 'Required for uphold; shown to the business. Max 2000.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({
    enum: ['approve', 're_review'],
    description: 'Overturn target. Forced to re_review when the item was edited since the rejection.',
  })
  @IsOptional()
  @IsIn(['approve', 're_review'])
  overturnTo?: 'approve' | 're_review';

  @ApiPropertyOptional({ enum: REJECTION_CATEGORIES, description: 'Uphold only: fix a wrong category.' })
  @IsOptional()
  @IsIn(REJECTION_CATEGORIES as unknown as string[])
  correctedCategory?: RejectionCategory;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class InspectionAccessoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(99)
  count!: number;
}

export class InspectionItemDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ enum: ['good', 'fair', 'damaged'] })
  @IsIn(['good', 'fair', 'damaged'])
  condition!: 'good' | 'fair' | 'damaged';

  @ApiProperty({ type: [InspectionAccessoryDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => InspectionAccessoryDto)
  accessories!: InspectionAccessoryDto[];

  @ApiProperty({ description: 'Wear note, or "none"' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  wear!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  checklistNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  physicalLabel?: string;

  @ApiPropertyOptional({
    enum: ['condition', 'accessories', 'wear', 'notes'],
    isArray: true,
    description: 'Checklist fields still showing the last-report tag.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsIn(['condition', 'accessories', 'wear', 'notes'], { each: true })
  guideUnconfirmed?: Array<'condition' | 'accessories' | 'wear' | 'notes'>;
}

export class SaveInspectionItemsDto {
  @ApiProperty({ type: [InspectionItemDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InspectionItemDto)
  items!: InspectionItemDto[];
}

export class AcknowledgeInspectionDto {
  @ApiProperty()
  @IsUUID()
  versionId!: string;

  @ApiProperty({ enum: ['accept', 'correction', 'dispute'] })
  @IsIn(['accept', 'correction', 'dispute'])
  decision!: 'accept' | 'correction' | 'dispute';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class PresignInspectionEvidenceDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty({ enum: ['overview', 'other_side', 'accessories', 'wear', 'counter'] })
  @IsIn(['overview', 'other_side', 'accessories', 'wear', 'counter'])
  role!: 'overview' | 'other_side' | 'accessories' | 'wear' | 'counter';

  @ApiProperty()
  @IsString()
  contentType!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiPropertyOptional({
    description: 'SHA-256 hex of the file bytes. Signed as x-amz-checksum-sha256 when present.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{64}$/i)
  sha256?: string;

  @ApiPropertyOptional({
    description: 'Angle slot. Required roles use the role name. Extra angles use extra:N. The server sets the capture time.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(overview|other_side|accessories|extra:[1-9]\d{0,2})$/)
  slotKey?: string;
}

export class ApplyPickupGuideDto {
  @ApiProperty({ enum: ['guide', 'blank'] })
  @IsIn(['guide', 'blank'])
  mode!: 'guide' | 'blank';
}

export class ClearPickupSlotDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^extra:[1-9]\d{0,2}$/)
  slotKey!: string;
}

export class SkipPickupSlotDto {
  @ApiProperty()
  @IsUUID()
  unitId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^extra:[1-9]\d{0,2}$/)
  slotKey!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  reason!: string;
}

export class SubmitInspectionDto {
  @ApiPropertyOptional({ description: 'Business claim. Required when a return unit is damaged.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  claimedDamageAmount?: number;
}

export class AdjustOvertimeDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overtimeAmount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}

export class AdminHandbackDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}

export class DecideInspectionDisputeDto {
  @ApiProperty({ enum: ['no_damage', 'damage_upheld', 'damage_rejected'] })
  @IsIn(['no_damage', 'damage_upheld', 'damage_rejected'])
  outcome!: 'no_damage' | 'damage_upheld' | 'damage_rejected';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({
    description:
      'Optional here. damage_upheld still requires a positive amount; the service returns 400 RENTAL_INSPECTION_DAMAGE_AMOUNT.',
  })
  @IsOptional()
  @Type(() => Number)
  damageAmount?: number;
}

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  damageAmount?: number;
}

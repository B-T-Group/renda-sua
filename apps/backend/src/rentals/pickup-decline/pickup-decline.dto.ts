import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { DECLINE_REASONS } from './pickup-decline.policy';

export class DeclineConditionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  versionId!: string;

  @ApiProperty({ enum: DECLINE_REASONS })
  @IsIn(DECLINE_REASONS)
  reason!: string;

  @ApiPropertyOptional()
  @ValidateIf((body: DeclineConditionDto) => body.reason === 'other')
  @IsString()
  @MaxLength(2000)
  text?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUUID('all', { each: true })
  photos?: string[];
}

export class DeclinePhotoPresignDto {
  @ApiProperty()
  @IsString()
  contentType!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiProperty({ enum: ['camera', 'gallery', 'web'] })
  @IsIn(['camera', 'gallery', 'web'])
  captureSource!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sha256?: string;
}

export class MarkDeclineRefundDto {
  @ApiProperty({ enum: ['refunded', 'failed'] })
  @IsIn(['refunded', 'failed'])
  status!: 'refunded' | 'failed';
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  DELIVERY_REPORT_TYPES,
  type DeliveryReportType,
} from '../client-confirm-delivery.constants';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsUUID,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class DeliveryProofPhotoDto {
  @ApiProperty({ description: 'Uploaded photo URL (camera capture)' })
  @IsString()
  @IsUrl({ require_tld: false })
  photoUrl!: string;

  @ApiProperty({ description: 'Device capture timestamp (ISO 8601)' })
  @IsISO8601()
  capturedAt!: string;

  @ApiProperty({ description: 'GPS latitude at capture' })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ description: 'GPS longitude at capture' })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ClientCouldNotConfirmDto {
  @ApiProperty({ type: [DeliveryProofPhotoDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryProofPhotoDto)
  photos!: DeliveryProofPhotoDto[];
}

export class ReportDeliveryProblemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ enum: DELIVERY_REPORT_TYPES })
  @IsOptional()
  @IsIn(DELIVERY_REPORT_TYPES as unknown as string[])
  type?: DeliveryReportType;

  @ApiPropertyOptional({
    description: 'issue: missing_items|wrong_items|damaged|other; delivery_failed: courier_didnt_come|not_received|other',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsUrl({ require_tld: false }, { each: true })
  photoUrls?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  itemIds?: string[];
}

export class GenerateOverwriteCodeDto {
  @ApiProperty({ description: 'Required audit reason for PIN overwrite' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

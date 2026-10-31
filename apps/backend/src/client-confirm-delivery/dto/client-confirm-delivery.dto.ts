import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
}

export class GenerateOverwriteCodeDto {
  @ApiProperty({ description: 'Required audit reason for PIN overwrite' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}

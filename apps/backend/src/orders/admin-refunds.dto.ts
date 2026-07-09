import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { RefundDestination } from './refund.types';

export class ForceRefundDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId!: string;

  @ApiPropertyOptional({ description: 'Full refund when omitted' })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({ enum: ['stripe', 'wallet', 'manual'] })
  @IsOptional()
  @IsEnum(['stripe', 'wallet', 'manual'])
  forceDestination?: RefundDestination;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  refundDeliveryFee?: boolean;
}

export class UploadRefundEvidenceDto {
  @ApiProperty()
  @IsString()
  fileUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class RefundInfoMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  message!: string;
}

export class RequestReturnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string;
}

export class RequestInfoDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  message!: string;
}

export class MarkReturnReceivedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  inspectionNotes?: string;
}

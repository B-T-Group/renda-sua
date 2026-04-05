import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export enum RefundRequestReasonDto {
  not_delivered = 'not_delivered',
  wrong_item = 'wrong_item',
  damaged = 'damaged',
  quality_issue = 'quality_issue',
  missing_parts = 'missing_parts',
  other = 'other',
}

export class CreateRefundRequestDto {
  @ApiProperty({ enum: RefundRequestReasonDto })
  @IsEnum(RefundRequestReasonDto)
  reason!: RefundRequestReasonDto;

  @ApiPropertyOptional({ maxLength: 20000 })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  clientNotes?: string;
}

export class ApproveFullRefundDto {
  @ApiProperty({
    description: 'Business confirms the item was returned for inspection',
  })
  @IsBoolean()
  inspectionAcknowledged!: boolean;

  @ApiPropertyOptional({
    description: 'Whether to also refund delivery fees to the client',
  })
  @IsOptional()
  @IsBoolean()
  refundDeliveryFee?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  businessNote?: string;
}

export class ApprovePartialRefundDto {
  @ApiProperty({
    description:
      'Refund amount for items only; must be strictly less than order subtotal',
  })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    description: 'Business confirms the item was returned for inspection',
  })
  @IsBoolean()
  inspectionAcknowledged!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  businessNote?: string;
}

export class ApproveReplaceItemDto {
  @ApiProperty({
    description: 'Business confirms the item was returned for inspection',
  })
  @IsBoolean()
  inspectionAcknowledged!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  businessNote?: string;
}

export class RejectRefundDto {
  @ApiProperty({ description: 'Required for audit / customer communication' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  rejectionReason!: string;
}

export class OrderIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdminReviewDto {
  @ApiProperty({ enum: ['APPROVE', 'CHANGES_REQUESTED', 'REJECT'] })
  @IsIn(['APPROVE', 'CHANGES_REQUESTED', 'REJECT'])
  decision!: 'APPROVE' | 'CHANGES_REQUESTED' | 'REJECT';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class AttachManufacturerQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attachmentUploadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  leadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class ExportFeeLineDto {
  @ApiProperty({
    enum: ['freight_maritime', 'customs_departure', 'export_prep', 'other'],
  })
  @IsIn(['freight_maritime', 'customs_departure', 'export_prep', 'other'])
  feeType!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  intervenant?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class ExportLinePriceDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  manufacturerUnitCost?: number;
}

export class IssueProformaDto {
  @ApiProperty({ type: [ExportLinePriceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportLinePriceDto)
  lines!: ExportLinePriceDto[];

  @ApiPropertyOptional({ type: [ExportFeeLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExportFeeLineDto)
  fees?: ExportFeeLineDto[];

  @ApiPropertyOptional({ description: 'Deposit rate 0–1', default: 0.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  depositRate?: number;

  @ApiPropertyOptional({ default: 0.05 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  creditRateFull?: number;

  @ApiPropertyOptional({ default: 0.025 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  creditRate30?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  creditRate60?: number;

  @ApiPropertyOptional({ default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  validityDays?: number;
}

export class RecordExportPaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ default: 'wire' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  valueDate?: string;

  @ApiPropertyOptional({
    enum: ['deposit', 'balance', 'financing_repayment', 'other'],
    default: 'deposit',
  })
  @IsOptional()
  @IsIn(['deposit', 'balance', 'financing_repayment', 'other'])
  allocation?: string;
}

export class UpsertExportBankAccountDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  institution!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  transit?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  accountNumber!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  swift?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  beneficiary!: string;

  @ApiPropertyOptional({ default: 'CAD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class ClientProformaActionDto {
  @ApiProperty({ enum: ['approve', 'request_adjustment'] })
  @IsIn(['approve', 'request_adjustment'])
  action!: 'approve' | 'request_adjustment';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class SelectBalanceOptionDto {
  @ApiProperty({ enum: ['FULL', 'FINANCED_30', 'FINANCED_60'] })
  @IsIn(['FULL', 'FINANCED_30', 'FINANCED_60'])
  option!: 'FULL' | 'FINANCED_30' | 'FINANCED_60';
}

export class RecordShipmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  carrier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  trackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  billOfLading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  certificateOfOrigin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RecordSupplierPaymentDto {
  @ApiProperty({ enum: ['deposit', 'balance'] })
  @IsIn(['deposit', 'balance'])
  kind!: 'deposit' | 'balance';

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  proofUploadId?: string;
}

export class ManufacturerConfirmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  leadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attachmentUploadId?: string;
}

export class ConfirmDeliveryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reserves?: string;

  @ApiPropertyOptional()
  @IsOptional()
  openDispute?: boolean;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

const PAYMENT_ENTITIES = [
  'order',
  'account',
  'claim_order',
  'rental_booking',
  'order_cash_reconciliation',
] as const;

export class InitiateStripePaymentDto {
  @ApiProperty({ description: 'Amount in major currency units (e.g. 12.50)' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'ISO 4217 currency code (e.g. CAD)' })
  @IsString()
  currency!: string;

  @ApiProperty({ description: 'Human-readable payment description' })
  @IsString()
  description!: string;

  @ApiProperty({ required: false, description: 'Customer email for the receipt' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty({
    required: false,
    description: 'Internal wallet account id to credit on success',
  })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({
    required: false,
    enum: PAYMENT_ENTITIES,
    description: 'Domain entity this payment finalizes',
  })
  @IsOptional()
  @IsIn(PAYMENT_ENTITIES as unknown as string[])
  paymentEntity?: (typeof PAYMENT_ENTITIES)[number];

  @ApiProperty({ required: false, description: 'Domain entity identifier' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({ required: false, description: 'Override success redirect URL' })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiProperty({ required: false, description: 'Override cancel redirect URL' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

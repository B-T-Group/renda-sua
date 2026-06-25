import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class WithdrawStripeDto {
  @ApiProperty({ description: 'Amount to withdraw in major currency units' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ description: 'ISO 4217 currency code (e.g. CAD)' })
  @IsString()
  currency!: string;

  @ApiProperty({ description: 'Internal wallet account id to debit' })
  @IsString()
  accountId!: string;

  @ApiProperty({ required: false, description: 'Optional payout description' })
  @IsOptional()
  @IsString()
  description?: string;
}

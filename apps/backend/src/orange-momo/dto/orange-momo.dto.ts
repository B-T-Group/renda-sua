import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MpPayDto {
  @ApiPropertyOptional({ description: 'Orange pay token from init' })
  @IsOptional()
  @IsString()
  payToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  subscriberMsisdn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CashinPayDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  subscriberMsisdn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CashoutPayDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subscriberMsisdn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class C2cPayDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromChannelMsisdn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toChannelMsisdn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class Ic2cPayDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notifUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toChannelMsisdn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromChannelMsisdn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class BulkPaymentStatusDto {
  @ApiProperty({ description: 'Bulk payload per Orange API' })
  @IsString()
  @IsNotEmpty()
  payload!: string;
}

export class SubscriberInfosDto {
  @ApiPropertyOptional({
    description: 'Optional PIN; channel MSISDN is taken from server config',
  })
  @IsOptional()
  @IsString()
  pin?: string;
}

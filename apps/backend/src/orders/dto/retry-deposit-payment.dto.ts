import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RetryDepositPaymentDto {
  @ApiProperty({
    description: 'Optional override phone number for the MoMo payment request (E.164)',
    required: false,
    example: '+241062345678',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;
}

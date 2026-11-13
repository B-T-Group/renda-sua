import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SaveRentalCardDto {
  @ApiProperty({ enum: ['payment_sheet', 'checkout'] })
  @IsIn(['payment_sheet', 'checkout'])
  channel!: 'payment_sheet' | 'checkout';
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateRentalBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  rentalRequestId!: string;

  @ApiPropertyOptional({
    enum: ['payment_sheet'],
    description:
      'When set to payment_sheet on Stripe rail, returns a PaymentIntent client secret for native PaymentSheet (mobile). Omit for hosted Checkout (web).',
  })
  @IsOptional()
  @IsIn(['payment_sheet'])
  stripe_payment_method?: 'payment_sheet';
}

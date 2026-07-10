import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class RetryRentalBookingPaymentDto {
  @ApiPropertyOptional({
    enum: ['payment_sheet'],
    description:
      'When set to payment_sheet on Stripe rail, returns a PaymentIntent client secret for native PaymentSheet (mobile).',
  })
  @IsOptional()
  @IsIn(['payment_sheet'])
  stripe_payment_method?: 'payment_sheet';
}

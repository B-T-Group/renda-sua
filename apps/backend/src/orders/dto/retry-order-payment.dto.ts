import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RetryOrderPaymentDto {
  @ApiProperty({
    required: false,
    enum: ['payment_sheet'],
    description:
      'For Stripe-rail orders, return a PaymentIntent client secret for native PaymentSheet instead of a hosted Checkout URL.',
  })
  @IsOptional()
  @IsIn(['payment_sheet'])
  stripe_payment_method?: 'payment_sheet';

  @ApiProperty({
    required: false,
    example: '+237677414565',
    description:
      'Mobile money only. Phone to send this request to (E.164 preferred). Omit to resend to the current payer phone. For pay-after-confirm orders a changed number is validated, used for this order only and saved to orders.payer_phone after the provider accepts the request.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone_number?: string;

  @ApiProperty({
    required: false,
    description:
      'Pay-after-confirm only: also save a changed number to your mobile money phones.',
  })
  @IsOptional()
  @IsBoolean()
  save_phone?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Alternative to the Idempotency-Key header (header wins when both are sent).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotency_key?: string;
}

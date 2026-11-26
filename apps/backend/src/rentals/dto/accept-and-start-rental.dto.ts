import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

const STRIPE_METHOD_DOC =
  'Card pay at pickup: payment_sheet returns a PaymentIntent client secret for the native PaymentSheet (mobile). Omit for hosted Checkout (web).';

export class AcceptAndStartRentalDto {
  @ApiProperty({ format: 'uuid', description: 'Current pickup inspection version the renter reviewed' })
  @IsUUID()
  versionId!: string;

  @ApiPropertyOptional({ enum: ['payment_sheet'], description: STRIPE_METHOD_DOC })
  @IsOptional()
  @IsIn(['payment_sheet'])
  stripe_payment_method?: 'payment_sheet';
}

/** Optional body for POST bookings/:id/start. */
export class StartRentalDto {
  @ApiPropertyOptional({ enum: ['payment_sheet'], description: STRIPE_METHOD_DOC })
  @IsOptional()
  @IsIn(['payment_sheet'])
  stripe_payment_method?: 'payment_sheet';
}

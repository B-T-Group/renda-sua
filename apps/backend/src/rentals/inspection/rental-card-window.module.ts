import { Module } from '@nestjs/common';
import { StripePaymentsModule } from '../../stripe-payments/stripe-payments.module';
import { RentalCardWindowService } from './rental-card-window.service';
import { RentalInspectionFlags } from './rental-inspection-flags.service';

/** Card-window policy without pulling the rentals controllers into the assistant. */
@Module({
  imports: [StripePaymentsModule],
  providers: [RentalInspectionFlags, RentalCardWindowService],
  exports: [RentalInspectionFlags, RentalCardWindowService],
})
export class RentalCardWindowModule {}

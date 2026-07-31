import { Module } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { MobilePaymentsCoreModule } from '../mobile-payments/mobile-payments-core.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { MobilePaymentPhoneSeedService } from './mobile-payment-phone-seed.service';

/**
 * Thin seed helpers for signup/persona flows — no Auth/Admin imports.
 */
@Module({
  imports: [HasuraModule, MobilePaymentsCoreModule, StripePaymentsModule],
  providers: [MobilePaymentPhoneSeedService],
  exports: [MobilePaymentPhoneSeedService],
})
export class MobilePaymentPhoneSeedModule {}

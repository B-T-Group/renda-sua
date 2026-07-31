import { Module, forwardRef } from '@nestjs/common';
import { HasuraModule } from '../hasura/hasura.module';
import { MobilePaymentsCoreModule } from '../mobile-payments/mobile-payments-core.module';
import { MobilePaymentsModule } from '../mobile-payments/mobile-payments.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { MobilePaymentPhoneSeedModule } from './mobile-payment-phone-seed.module';
import { MobilePaymentPhonesController } from './mobile-payment-phones.controller';
import { MobilePaymentPhonesService } from './mobile-payment-phones.service';
import { PhoneVerificationCallbackHandler } from './phone-verification-callback.handler';

@Module({
  imports: [
    HasuraModule,
    MobilePaymentsCoreModule,
    MobilePaymentPhoneSeedModule,
    forwardRef(() => MobilePaymentsModule),
    forwardRef(() => MerchantLifecycleModule),
    forwardRef(() => StripePaymentsModule),
  ],
  controllers: [MobilePaymentPhonesController],
  providers: [MobilePaymentPhonesService, PhoneVerificationCallbackHandler],
  exports: [
    MobilePaymentPhonesService,
    PhoneVerificationCallbackHandler,
    MobilePaymentPhoneSeedModule,
  ],
})
export class MobilePaymentPhonesModule {}

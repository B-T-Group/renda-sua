import { Module } from '@nestjs/common';
import { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import { PaymentRoutingService } from './payment-routing.service';
import { StripeConnectController } from './stripe-connect.controller';
import { StripeConnectService } from './stripe-connect.service';
import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';
import { StripePaymentsController } from './stripe-payments.controller';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripePayoutService } from './stripe-payout.service';
import { StripeService } from './stripe.service';

@Module({
  controllers: [StripePaymentsController, StripeConnectController],
  providers: [
    StripeService,
    StripePaymentsDatabaseService,
    StripeConnectService,
    StripePayoutService,
    StripePaymentCallbackProcessor,
    PaymentCallbackRegistryService,
    PaymentRoutingService,
  ],
  exports: [
    StripeService,
    StripePayoutService,
    StripeConnectService,
    PaymentRoutingService,
  ],
})
export class StripePaymentsModule {}

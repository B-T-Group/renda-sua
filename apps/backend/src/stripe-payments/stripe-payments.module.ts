import { Module, forwardRef } from '@nestjs/common';
import { RefundsModule } from '../orders/refunds.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { StripeTaxModule } from '../stripe-tax/stripe-tax.module';
import { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import { PaymentRoutingService } from './payment-routing.service';
import { StripeCaptureService } from './stripe-capture.service';
import { StripeCheckoutService } from './stripe-checkout.service';
import { StripeConnectController } from './stripe-connect.controller';
import { StripeConnectService } from './stripe-connect.service';
import { StripePaymentCallbackProcessor } from './stripe-payment-callback.processor';
import { StripePaymentsController } from './stripe-payments.controller';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripePayoutService } from './stripe-payout.service';
import { StripeRefundService } from './stripe-refund.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    forwardRef(() => MerchantLifecycleModule),
    forwardRef(() => StripeTaxModule),
    forwardRef(() => RefundsModule),
  ],
  controllers: [StripePaymentsController, StripeConnectController],
  providers: [
    StripeService,
    StripePaymentsDatabaseService,
    StripeCheckoutService,
    StripeConnectService,
    StripePayoutService,
    StripeRefundService,
    StripeCaptureService,
    StripePaymentCallbackProcessor,
    PaymentCallbackRegistryService,
    PaymentRoutingService,
  ],
  exports: [
    StripeService,
    StripeCheckoutService,
    StripePayoutService,
    StripeConnectService,
    StripeRefundService,
    StripeCaptureService,
    PaymentRoutingService,
    StripePaymentsDatabaseService,
  ],
})
export class StripePaymentsModule {}

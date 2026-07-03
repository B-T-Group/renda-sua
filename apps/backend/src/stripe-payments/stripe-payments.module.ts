import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import { PaymentRoutingService } from './payment-routing.service';
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
  imports: [OrdersModule],
  controllers: [StripePaymentsController, StripeConnectController],
  providers: [
    StripeService,
    StripePaymentsDatabaseService,
    StripeCheckoutService,
    StripeConnectService,
    StripePayoutService,
    StripeRefundService,
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
    PaymentRoutingService,
  ],
})
export class StripePaymentsModule {}


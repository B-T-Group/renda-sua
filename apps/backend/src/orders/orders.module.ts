import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AgentsModule } from '../agents/agents.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { StripeTaxModule } from '../stripe-tax/stripe-tax.module';
import { StripeAuthReconcilerService } from '../stripe-payments/stripe-auth-reconciler.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { CheckoutPreflightService } from './checkout-preflight.service';
import { FailedDeliveriesController } from './failed-deliveries.controller';
import { FailedDeliveriesService } from './failed-deliveries.service';
import { OrderNotificationsInternalController } from './order-notifications-internal.controller';
import { OrderOffersService } from './order-offers.service';
import { OrderPaymentCallbackHandler } from './order-payment-callback.handler';
import { OrderQueueService } from './order-queue.service';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { RefundsModule } from './refunds.module';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

@Module({
  imports: [
    NotificationsModule,
    MessagingModule,
    LoyaltyModule,
    AdminModule,
    AgentsModule,
    DeliveryModule,
    DeliveryConfigModule,
    CommissionsModule,
    PdfModule,
    StripePaymentsModule,
    StripeTaxModule,
    RefundsModule,
  ],
  controllers: [
    OrdersController,
    FailedDeliveriesController,
    OrderNotificationsInternalController,
  ],
  providers: [
    OrdersService,
    OrderStatusService,
    OrderQueueService,
    OrderOffersService,
    WaitAndExecuteScheduleService,
    FailedDeliveriesService,
    OrderPaymentCallbackHandler,
    CheckoutPreflightService,
    CancellationPolicyService,
    StripeAuthReconcilerService,
  ],
  exports: [OrdersService, OrderStatusService, OrderPaymentCallbackHandler, CancellationPolicyService, RefundsModule],
})
export class OrdersModule {}

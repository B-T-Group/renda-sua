import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AgentsModule } from '../agents/agents.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { FailedDeliveriesController } from './failed-deliveries.controller';
import { FailedDeliveriesService } from './failed-deliveries.service';
import { OrderNotificationsInternalController } from './order-notifications-internal.controller';
import { OrderPaymentCallbackHandler } from './order-payment-callback.handler';
import { OrderRefundsController } from './order-refunds.controller';
import { OrderRefundsService } from './order-refunds.service';
import { OrderQueueService } from './order-queue.service';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

@Module({
  imports: [
    NotificationsModule,
    LoyaltyModule,
    AdminModule,
    AgentsModule,
    DeliveryModule,
    DeliveryConfigModule,
    CommissionsModule,
    PdfModule,
    StripePaymentsModule,
  ],
  controllers: [
    OrderRefundsController,
    OrdersController,
    FailedDeliveriesController,
    OrderNotificationsInternalController,
  ],
  providers: [
    OrdersService,
    OrderRefundsService,
    OrderStatusService,
    OrderQueueService,
    WaitAndExecuteScheduleService,
    FailedDeliveriesService,
    OrderPaymentCallbackHandler,
  ],
  exports: [OrdersService, OrderStatusService, OrderPaymentCallbackHandler],
})
export class OrdersModule {}

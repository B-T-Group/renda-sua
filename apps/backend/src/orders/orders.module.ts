import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AgentsModule } from '../agents/agents.module';
import { CommerceIntegrationsModule } from '../commerce-integrations/commerce-integrations.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { DeliveryAvailabilityModule } from '../delivery-availability/delivery-availability.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { LocationsModule } from '../locations/locations.module';
import { GoogleModule } from '../google/google.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { MessagingModule } from '../messaging/messaging.module';
import { MetaConversionsModule } from '../meta-conversions/meta-conversions.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { RbacModule } from '../rbac/rbac.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { StripeTaxModule } from '../stripe-tax/stripe-tax.module';
import { StripeAuthReconcilerService } from '../stripe-payments/stripe-auth-reconciler.service';
import { CancellationPolicyService } from './cancellation-policy.service';
import { CheckoutPreflightService } from './checkout-preflight.service';
import { FailedDeliveriesController } from './failed-deliveries.controller';
import { FailedDeliveriesService } from './failed-deliveries.service';
import { BusinessAvailabilityController } from './business-availability.controller';
import { OrderAcceptanceInternalController } from './order-acceptance-internal.controller';
import { OrderAcceptanceService } from './order-acceptance.service';
import { OrderDispatchInternalController } from './order-dispatch-internal.controller';
import { OrderEventsService } from './order-events.service';
import { OrderNotificationsInternalController } from './order-notifications-internal.controller';
import { OrderOffersService } from './order-offers.service';
import { OrderPaymentCallbackHandler } from './order-payment-callback.handler';
import { OrderPickupAnalyticsService } from './order-pickup-analytics.service';
import { OrderPickupMonitorService } from './order-pickup-monitor.service';
import { OrderQueueService } from './order-queue.service';
import { OrderReassignmentService } from './order-reassignment.service';
import { OrderStatusService } from './order-status.service';
import { OrderCleanupCronService } from './order-cleanup-cron.service';
import { OrderCleanupInternalController } from './order-cleanup-internal.controller';
import { OrderCleanupService } from './order-cleanup.service';
import { OrderSystemJobsService } from './order-system-jobs.service';
import { AdminPickupOpsController } from './admin-pickup-ops.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PickupProgressService } from './pickup-progress.service';
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
    DeliveryAvailabilityModule,
    DeliveryConfigModule,
    CommissionsModule,
    PdfModule,
    StripePaymentsModule,
    StripeTaxModule,
    RefundsModule,
    LocationsModule,
    GoogleModule,
    RbacModule,
    CommerceIntegrationsModule,
    MetaConversionsModule,
    MerchantLifecycleModule,
  ],
  controllers: [
    OrdersController,
    AdminPickupOpsController,
    FailedDeliveriesController,
    OrderNotificationsInternalController,
    OrderAcceptanceInternalController,
    OrderDispatchInternalController,
    OrderCleanupInternalController,
    BusinessAvailabilityController,
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
    OrderCleanupService,
    OrderCleanupCronService,
    OrderSystemJobsService,
    OrderAcceptanceService,
    OrderEventsService,
    PickupProgressService,
    OrderReassignmentService,
    OrderPickupMonitorService,
    OrderPickupAnalyticsService,
    StripeAuthReconcilerService,
  ],
  exports: [
    OrdersService,
    OrderStatusService,
    OrderPaymentCallbackHandler,
    CancellationPolicyService,
    RefundsModule,
    OrderCleanupService,
    OrderSystemJobsService,
    OrderAcceptanceService,
    OrderEventsService,
    OrderPickupMonitorService,
    OrderReassignmentService,
    OrderPickupAnalyticsService,
  ],
})
export class OrdersModule {}

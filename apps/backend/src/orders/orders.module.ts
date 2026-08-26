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
import { RepresentativeCompensationModule } from '../representative-compensation/representative-compensation.module';
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
import { FulfillmentPromiseService } from './fulfillment-promise.service';
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
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminOrderContactService } from './admin-order-contact.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderRiskService } from './order-risk.service';
import { OrderRiskAlertService } from './order-risk-alert.service';
import { OrderRiskConfigService } from './order-risk-config.service';
import { OrderRiskIncidentsService } from './order-risk-incidents.service';
import { OrderRiskMonitorService } from './order-risk-monitor.service';
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
    RepresentativeCompensationModule,
  ],
  controllers: [
    OrdersController,
    AdminPickupOpsController,
    AdminOrdersController,
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
    OrderRiskService,
    OrderRiskConfigService,
    OrderRiskIncidentsService,
    OrderRiskAlertService,
    OrderRiskMonitorService,
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
    FulfillmentPromiseService,
    OrderEventsService,
    PickupProgressService,
    OrderReassignmentService,
    OrderPickupMonitorService,
    OrderPickupAnalyticsService,
    StripeAuthReconcilerService,
    AdminOrderContactService,
    AdminOrdersService,
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
    FulfillmentPromiseService,
    OrderEventsService,
    OrderPickupMonitorService,
    OrderReassignmentService,
    OrderPickupAnalyticsService,
    OrderRiskIncidentsService,
    OrderRiskMonitorService,
    FailedDeliveriesService,
  ],
})
export class OrdersModule {}

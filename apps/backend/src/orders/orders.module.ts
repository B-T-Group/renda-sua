import { Global, Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { AgentsModule } from '../agents/agents.module';
import { CommissionsModule } from '../commissions/commissions.module';
import { DeliveryConfigModule } from '../delivery-configs/delivery-configs.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { GoogleModule } from '../google/google.module';
import { LocationsModule } from '../locations/locations.module';
import { MobilePaymentsModule } from '../mobile-payments/mobile-payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { DeliveryPinService } from './delivery-pin.service';
import { FailedDeliveriesController } from './failed-deliveries.controller';
import { FailedDeliveriesService } from './failed-deliveries.service';
import { OrderRefundsController } from './order-refunds.controller';
import { OrderRefundsService } from './order-refunds.service';
import { OrderQueueService } from './order-queue.service';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { WaitAndExecuteScheduleService } from './wait-and-execute-schedule.service';

@Global()
@Module({
  imports: [
    GoogleModule,
    forwardRef(() => MobilePaymentsModule),
    NotificationsModule,
    LoyaltyModule,
    AdminModule,
    forwardRef(() => AgentsModule),
    DeliveryModule,
    DeliveryConfigModule,
    forwardRef(() => CommissionsModule),
    PdfModule,
    LocationsModule,
  ],
  controllers: [OrderRefundsController, OrdersController, FailedDeliveriesController],
  providers: [
    OrdersService,
    OrderRefundsService,
    OrderStatusService,
    OrderQueueService,
    WaitAndExecuteScheduleService,
    ConfigurationsService,
    FailedDeliveriesService,
    DeliveryPinService,
  ],
  exports: [OrdersService, OrderStatusService, DeliveryPinService],
})
export class OrdersModule {}

import { Global, Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { CommissionsModule } from '../commissions/commissions.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { GoogleModule } from '../google/google.module';
import { MobilePaymentsModule } from '../mobile-payments/mobile-payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfModule } from '../pdf/pdf.module';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Global()
@Module({
  imports: [
    GoogleModule,
    forwardRef(() => MobilePaymentsModule),
    NotificationsModule,
    AdminModule,
    DeliveryModule,
    CommissionsModule,
    PdfModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStatusService, ConfigurationsService],
  exports: [OrdersService, OrderStatusService],
})
export class OrdersModule {}

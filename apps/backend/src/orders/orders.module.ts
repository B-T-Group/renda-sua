import { Global, Module, forwardRef } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { MobilePaymentsModule } from '../mobile-payments/mobile-payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Global()
@Module({
  imports: [
    GoogleModule,
    forwardRef(() => MobilePaymentsModule),
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStatusService],
  exports: [OrdersService, OrderStatusService],
})
export class OrdersModule {}

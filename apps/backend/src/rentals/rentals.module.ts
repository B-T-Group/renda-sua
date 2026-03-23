import { forwardRef, Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { MobilePaymentsModule } from '../mobile-payments/mobile-payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({
  imports: [
    forwardRef(() => MobilePaymentsModule),
    OrdersModule,
    NotificationsModule,
    InventoryItemsModule,
    GoogleModule,
  ],
  controllers: [RentalsController],
  providers: [RentalsService, RentalsCronService],
  exports: [RentalsService],
})
export class RentalsModule {}

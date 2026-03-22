import { Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({
  imports: [OrdersModule, NotificationsModule, InventoryItemsModule, GoogleModule],
  controllers: [RentalsController],
  providers: [RentalsService, RentalsCronService],
  exports: [RentalsService],
})
export class RentalsModule {}

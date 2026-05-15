import { forwardRef, Module } from '@nestjs/common';
import { GoogleModule } from '../google/google.module';
import { InventoryItemsModule } from '../inventory-items/inventory-items.module';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({
  imports: [
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../mobile-payments/mobile-payments.module').MobilePaymentsModule;
    }),
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../orders/orders.module').OrdersModule;
    }),
    forwardRef(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../notifications/notifications.module').NotificationsModule;
    }),
    InventoryItemsModule,
    GoogleModule,
  ],
  controllers: [RentalsController],
  providers: [RentalsService, RentalsCronService],
  exports: [RentalsService],
})
export class RentalsModule {}

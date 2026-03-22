import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';

@Module({
  imports: [OrdersModule, NotificationsModule],
  controllers: [RentalsController],
  providers: [RentalsService, RentalsCronService],
  exports: [RentalsService],
})
export class RentalsModule {}

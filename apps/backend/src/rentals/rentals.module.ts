import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalPaymentCallbackHandler } from './rental-payment-callback.handler';
import { RentalsController } from './rentals.controller';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsService } from './rentals.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RentalsController],
  providers: [RentalsService, RentalsCronService, RentalPaymentCallbackHandler],
  exports: [RentalsService, RentalPaymentCallbackHandler],
})
export class RentalsModule {}

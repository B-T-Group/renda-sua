import { Module } from '@nestjs/common';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { RentalPaymentCallbackHandler } from './rental-payment-callback.handler';
import { RentalsController } from './rentals.controller';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsService } from './rentals.service';

@Module({
  imports: [NotificationsModule, ImageValidationModule, StripePaymentsModule],
  controllers: [RentalsController],
  providers: [RentalsService, RentalsCronService, RentalPaymentCallbackHandler],
  exports: [RentalsService, RentalPaymentCallbackHandler],
})
export class RentalsModule {}

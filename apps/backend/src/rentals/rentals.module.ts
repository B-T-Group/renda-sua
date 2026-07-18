import { Module } from '@nestjs/common';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalListingAiReviewModule } from '../rental-listing-ai-review/rental-listing-ai-review.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { RentalPaymentCallbackHandler } from './rental-payment-callback.handler';
import { RentalBookingMessagingService } from './rental-booking-messaging.service';
import { RentalsController } from './rentals.controller';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsService } from './rentals.service';

@Module({
  imports: [
    NotificationsModule,
    ImageValidationModule,
    StripePaymentsModule,
    RentalListingAiReviewModule,
  ],
  controllers: [RentalsController],
  providers: [
    RentalsService,
    RentalsCronService,
    RentalPaymentCallbackHandler,
    RentalBookingMessagingService,
  ],
  exports: [RentalsService, RentalPaymentCallbackHandler],
})
export class RentalsModule {}

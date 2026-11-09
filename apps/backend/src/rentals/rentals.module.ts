import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalListingAiReviewModule } from '../rental-listing-ai-review/rental-listing-ai-review.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { AdminRentalBookingsController } from './admin-rental-bookings.controller';
import { RentalPaymentCallbackHandler } from './rental-payment-callback.handler';
import { RentalBookingMessagingService } from './rental-booking-messaging.service';
import { RentalStartPinShareService } from './rental-start-pin-share.service';
import { RentalsController } from './rentals.controller';
import { RentalsCronService } from './rentals-cron.service';
import { RentalsService } from './rentals.service';

@Module({
  imports: [
    AdminAuthModule,
    NotificationsModule,
    ImageValidationModule,
    StripePaymentsModule,
    RentalListingAiReviewModule,
  ],
  controllers: [RentalsController, AdminRentalBookingsController],
  providers: [
    RentalsService,
    RentalsCronService,
    RentalPaymentCallbackHandler,
    RentalStartPinShareService,
    RentalBookingMessagingService,
  ],
  exports: [RentalsService, RentalPaymentCallbackHandler],
})
export class RentalsModule {}

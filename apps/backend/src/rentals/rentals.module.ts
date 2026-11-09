import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AwsModule } from '../aws/aws.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalListingAiReviewModule } from '../rental-listing-ai-review/rental-listing-ai-review.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { AdminRentalBookingsController } from './admin-rental-bookings.controller';
import { RentalPaymentCallbackHandler } from './rental-payment-callback.handler';
import { RentalBookingMessagingService } from './rental-booking-messaging.service';
import { RentalStartPinShareService } from './rental-start-pin-share.service';
import { RentalInspectionsController } from './rental-inspections.controller';
import { RentalsController } from './rentals.controller';
import { RentalsCronService } from './rentals-cron.service';
import { RentalInspectionEvidenceService } from './inspection/rental-inspection-evidence.service';
import { RentalInspectionFlags } from './inspection/rental-inspection-flags.service';
import { RentalInspectionService } from './inspection/rental-inspection.service';
import { RentalsService } from './rentals.service';

@Module({
  imports: [
    AdminAuthModule,
    AwsModule,
    NotificationsModule,
    ImageValidationModule,
    StripePaymentsModule,
    RentalListingAiReviewModule,
  ],
  controllers: [RentalsController, RentalInspectionsController, AdminRentalBookingsController],
  providers: [
    RentalsService,
    RentalsCronService,
    RentalPaymentCallbackHandler,
    RentalStartPinShareService,
    RentalBookingMessagingService,
    RentalInspectionFlags,
    RentalInspectionService,
    RentalInspectionEvidenceService,
  ],
  exports: [RentalsService, RentalPaymentCallbackHandler],
})
export class RentalsModule {}

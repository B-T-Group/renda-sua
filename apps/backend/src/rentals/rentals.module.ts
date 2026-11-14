import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
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
import { RentalSearchController } from './rental-search.controller';
import { RentalsCronService } from './rentals-cron.service';
import { RentalInspectionEvidenceService } from './inspection/rental-inspection-evidence.service';
import { RentalCardWindowModule } from './inspection/rental-card-window.module';
import { RentalInspectionService } from './inspection/rental-inspection.service';
import { RentalNotReceivedService } from './inspection/rental-not-received.service';
import { RentalRenterReturnService } from './renter-return/rental-renter-return.service';
import { RentalsService } from './rentals.service';
import { RentalSearchService } from './rental-search.service';
import { RentalAvailabilityService } from './rental-availability.service';

@Module({
  imports: [
    AdminAuthModule,
    AppConfigModule,
    AwsModule,
    NotificationsModule,
    ImageValidationModule,
    StripePaymentsModule,
    RentalCardWindowModule,
    RentalListingAiReviewModule,
  ],
  controllers: [RentalsController, RentalSearchController, RentalInspectionsController, AdminRentalBookingsController],
  providers: [
    RentalsService,
    RentalSearchService,
    RentalAvailabilityService,
    RentalsCronService,
    RentalPaymentCallbackHandler,
    RentalStartPinShareService,
    RentalBookingMessagingService,
    RentalInspectionService,
    RentalNotReceivedService,
    RentalRenterReturnService,
    RentalInspectionEvidenceService,
  ],
  exports: [RentalsService, RentalSearchService, RentalPaymentCallbackHandler, RentalCardWindowModule],
})
export class RentalsModule {}

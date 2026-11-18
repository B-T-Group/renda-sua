import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { AwsModule } from '../aws/aws.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalListingAiReviewModule } from '../rental-listing-ai-review/rental-listing-ai-review.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { MtnMomoModule } from '../mtn-momo/mtn-momo.module';
import { AdminRentalBookingsController } from './admin-rental-bookings.controller';
import { RentalPaymentCallbackHandler } from './rental-payment-callback.handler';
import { RentalBookingMessagingService } from './rental-booking-messaging.service';
import { RentalStartPinShareService } from './rental-start-pin-share.service';
import { RentalInspectionsController } from './rental-inspections.controller';
import { RentalsController } from './rentals.controller';
import { RentalSearchController } from './rental-search.controller';
import { RentalsCronService } from './rentals-cron.service';
import { RentalInspectionEvidenceService } from './inspection/rental-inspection-evidence.service';
import { InspectionOptInService } from './inspection/inspection-optin.service';
import { PickupPhotoRulesService } from './inspection/pickup-photo-rules.service';
import { RentalCardWindowModule } from './inspection/rental-card-window.module';
import { RentalInspectionService } from './inspection/rental-inspection.service';
import { RentalNotReceivedService } from './inspection/rental-not-received.service';
import { RentalRenterReturnService } from './renter-return/rental-renter-return.service';
import { RentalsService } from './rentals.service';
import { RentalSearchService } from './rental-search.service';
import { RentalAvailabilityService } from './rental-availability.service';
import { RentalConditionPhotosService } from './pickup-decline/rental-condition-photos.service';
import { RentalDeclineCountsService } from './pickup-decline/rental-decline-counts.service';
import { RentalMomoRefundService } from './pickup-decline/rental-momo-refund.service';
import { RentalPickupDeclineService } from './pickup-decline/rental-pickup-decline.service';
import { DeclineExclusionService } from './decline-ranking/decline-exclusion.service';
import { DeclineRankingService } from './decline-ranking/decline-ranking.service';

@Module({
  imports: [
    AdminAuthModule,
    AppConfigModule,
    AwsModule,
    NotificationsModule,
    ImageValidationModule,
    StripePaymentsModule,
    MtnMomoModule,
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
    InspectionOptInService,
    PickupPhotoRulesService,
    RentalNotReceivedService,
    RentalRenterReturnService,
    RentalInspectionEvidenceService,
    RentalMomoRefundService,
    RentalConditionPhotosService,
    RentalPickupDeclineService,
    RentalDeclineCountsService,
    DeclineRankingService,
    DeclineExclusionService,
  ],
  exports: [RentalsService, RentalSearchService, RentalPaymentCallbackHandler, RentalCardWindowModule],
})
export class RentalsModule {}

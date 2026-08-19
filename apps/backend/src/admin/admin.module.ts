import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { AuthModule } from '../auth/auth.module';
import { BusinessReferralPayoutsModule } from '../business-referral-payouts/business-referral-payouts.module';
import { BusinessReferralsModule } from '../business-referrals/business-referrals.module';
import { AiGenerationModule } from '../ai/ai-generation.module';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { BusinessItemsModule } from '../business-items/business-items.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { SiteEventsModule } from '../site-events/site-events.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { AdminSiteEventsController } from './admin-site-events.controller';
import { AdminPerformanceController } from './admin-performance.controller';
import { AdminPerformanceService } from './admin-performance.service';
import { BusinessReferralReviewController } from './business-referral-review.controller';
import { BusinessReferralReviewService } from './business-referral-review.service';
import { AdminMessageService } from './admin-message.service';
import { AdminReferralService } from './admin-referral.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ApplicationSetupService } from './application-setup.service';
import { CountryOnboardingService } from './country-onboarding.service';
import { ConfigurationsController } from './configurations.controller';
import { ConfigurationsService } from './configurations.service';
import { RbacAdminController } from './rbac-admin.controller';
import { RentalListingModerationService } from './rental-listing-moderation.service';
import { ItemModerationService } from './item-moderation.service';
import { RentalListingAiReviewModule } from '../rental-listing-ai-review/rental-listing-ai-review.module';
import { ItemAiReviewModule } from '../item-ai-review/item-ai-review.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { AiImageCleanupModule } from '../ai-image-cleanup/ai-image-cleanup.module';
import { WithdrawalPinService } from './withdrawal-pin.service';
import { RbacModule } from '../rbac/rbac.module';
import { AdminAuthModule } from './admin-auth.module';
import { ThreadsModule } from '../threads/threads.module';
import { AdminBroadcastController } from './admin-broadcast.controller';
import { AdminBroadcastInternalController } from './admin-broadcast-internal.controller';
import { AdminBroadcastService } from './admin-broadcast.service';
import { AdminBroadcastAudienceService } from './admin-broadcast-audience.service';
import { AdminBroadcastQueueService } from './admin-broadcast-queue.service';
import { AdminCatalogItemsController } from './admin-catalog-items.controller';
import { AdminCatalogItemsService } from './admin-catalog-items.service';

@Module({
  imports: [
    AuthModule,
    AgentsModule,
    BusinessReferralsModule,
    BusinessReferralPayoutsModule,
    AdminAuthModule,
    RbacModule,
    HasuraModule,
    NotificationsModule,
    AiGenerationModule,
    SiteEventsModule,
    MerchantLifecycleModule,
    StripePaymentsModule,
    BusinessContractsModule,
    BusinessItemsModule,
    RentalListingAiReviewModule,
    ItemAiReviewModule,
    ImageValidationModule,
    AiImageCleanupModule,
    ThreadsModule,
  ],
  controllers: [
    AdminController,
    AdminCatalogItemsController,
    ConfigurationsController,
    AdminSiteEventsController,
    AdminPerformanceController,
    BusinessReferralReviewController,
    RbacAdminController,
    AdminBroadcastController,
    AdminBroadcastInternalController,
  ],
  providers: [
    AdminPerformanceService,
    BusinessReferralReviewService,
    AdminMessageService,
    AdminService,
    AdminReferralService,
    ConfigurationsService,
    RentalListingModerationService,
    ItemModerationService,
    AdminCatalogItemsService,
    ApplicationSetupService,
    CountryOnboardingService,
    WithdrawalPinService,
    AdminBroadcastService,
    AdminBroadcastAudienceService,
    AdminBroadcastQueueService,
  ],
  exports: [
    AdminAuthModule,
    RbacModule,
    AdminMessageService,
    AdminService,
    ConfigurationsService,
    BusinessReferralReviewService,
    RentalListingModerationService,
    ItemModerationService,
    ApplicationSetupService,
    CountryOnboardingService,
    WithdrawalPinService,
    AdminBroadcastService,
  ],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessContractsModule } from '../business-contracts/business-contracts.module';
import { BusinessItemsModule } from '../business-items/business-items.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MerchantLifecycleModule } from '../merchant-lifecycle/merchant-lifecycle.module';
import { SiteEventsModule } from '../site-events/site-events.module';
import { AdminSiteEventsController } from './admin-site-events.controller';
import { AdminMessageService } from './admin-message.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ApplicationSetupService } from './application-setup.service';
import { CountryOnboardingService } from './country-onboarding.service';
import { ConfigurationsController } from './configurations.controller';
import { ConfigurationsService } from './configurations.service';
import { RentalListingModerationService } from './rental-listing-moderation.service';
import { ItemModerationService } from './item-moderation.service';
import { RentalListingAiReviewModule } from '../rental-listing-ai-review/rental-listing-ai-review.module';
import { ItemAiReviewModule } from '../item-ai-review/item-ai-review.module';
import { ImageValidationModule } from '../image-validation/image-validation.module';
import { WithdrawalPinService } from './withdrawal-pin.service';

@Module({
  imports: [
    AuthModule,
    HasuraModule,
    NotificationsModule,
    SiteEventsModule,
    MerchantLifecycleModule,
    BusinessContractsModule,
    BusinessItemsModule,
    RentalListingAiReviewModule,
    ItemAiReviewModule,
    ImageValidationModule,
  ],
  controllers: [AdminController, ConfigurationsController, AdminSiteEventsController],
  providers: [
    AdminMessageService,
    AdminService,
    ConfigurationsService,
    RentalListingModerationService,
    ItemModerationService,
    ApplicationSetupService,
    CountryOnboardingService,
    WithdrawalPinService,
  ],
  exports: [
    AdminMessageService,
    AdminService,
    ConfigurationsService,
    RentalListingModerationService,
    ItemModerationService,
    ApplicationSetupService,
    CountryOnboardingService,
    WithdrawalPinService,
  ],
})
export class AdminModule {}

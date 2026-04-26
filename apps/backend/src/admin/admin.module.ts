import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
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
import { WithdrawalPinService } from './withdrawal-pin.service';

@Module({
  imports: [AuthModule, HasuraModule, NotificationsModule, SiteEventsModule],
  controllers: [AdminController, ConfigurationsController, AdminSiteEventsController],
  providers: [
    AdminMessageService,
    AdminService,
    ConfigurationsService,
    RentalListingModerationService,
    ApplicationSetupService,
    CountryOnboardingService,
    WithdrawalPinService,
  ],
  exports: [
    AdminMessageService,
    AdminService,
    ConfigurationsService,
    RentalListingModerationService,
    ApplicationSetupService,
    CountryOnboardingService,
    WithdrawalPinService,
  ],
})
export class AdminModule {}

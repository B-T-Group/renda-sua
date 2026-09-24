import { Module, forwardRef } from '@nestjs/common';
import { AdminAuthModule } from '../admin/admin-auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CashAdvanceService } from './cash-advance.service';
import { PartnerBusinessesService } from './partner-businesses.service';
import { PaymentProgramsAdminController } from './payment-programs-admin.controller';
import { PaymentProgramsUserController } from './payment-programs-user.controller';
import { PaymentScheduleCatalogService } from './payment-schedule-catalog.service';
import { PaymentScheduleConsentService } from './payment-schedule-consent.service';
import { PaymentScheduleInternalController } from './payment-schedule-internal.controller';
import { PaymentScheduleProgressService } from './payment-schedule-progress.service';
import { PaymentScheduleRunnerService } from './payment-schedule-runner.service';
import { CreditCampaignAdminController } from './credit-campaign-admin.controller';
import { CreditCampaignInternalController } from './credit-campaign-internal.controller';
import { CreditCampaignPublisher } from './credit-campaign-publisher.service';
import { CreditCampaignRunnerService } from './credit-campaign-runner.service';
import { CreditCampaignService } from './credit-campaign.service';
import { PurchaseCreditsService } from './purchase-credits.service';

@Module({
  imports: [AdminAuthModule, forwardRef(() => NotificationsModule)],
  controllers: [
    PaymentProgramsAdminController,
    PaymentProgramsUserController,
    PaymentScheduleInternalController,
    CreditCampaignAdminController,
    CreditCampaignInternalController,
  ],
  providers: [
    PurchaseCreditsService,
    CashAdvanceService,
    PaymentScheduleProgressService,
    PaymentScheduleConsentService,
    PaymentScheduleCatalogService,
    PaymentScheduleRunnerService,
    PartnerBusinessesService,
    CreditCampaignService,
    CreditCampaignRunnerService,
    CreditCampaignPublisher,
  ],
  exports: [PurchaseCreditsService, CreditCampaignPublisher, PaymentScheduleConsentService],
})
export class PaymentProgramsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { ReferralsModule } from '../referrals/referrals.module';
import { RepresentativeCompensationModule } from '../representative-compensation/representative-compensation.module';
import { BusinessReferralPayoutsInternalController } from './business-referral-payouts-internal.controller';
import { BusinessReferralPayoutsService } from './business-referral-payouts.service';
import { ReferralProjectedPayoutService } from './referral-projected-payout.service';
import { ReferralPayoutPreviewService } from './referral-payout-preview.service';

@Module({
  imports: [
    ConfigModule,
    StripePaymentsModule,
    ReferralsModule,
    RepresentativeCompensationModule,
  ],
  controllers: [BusinessReferralPayoutsInternalController],
  providers: [
    BusinessReferralPayoutsService,
    ReferralProjectedPayoutService,
    ReferralPayoutPreviewService,
    ConfigurationsService,
  ],
  exports: [
    BusinessReferralPayoutsService,
    ReferralProjectedPayoutService,
    ReferralPayoutPreviewService,
  ],
})
export class BusinessReferralPayoutsModule {}

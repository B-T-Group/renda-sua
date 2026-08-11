import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { ReferralsModule } from '../referrals/referrals.module';
import { BusinessReferralPayoutsInternalController } from './business-referral-payouts-internal.controller';
import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

@Module({
  imports: [ConfigModule, StripePaymentsModule, ReferralsModule],
  controllers: [BusinessReferralPayoutsInternalController],
  providers: [BusinessReferralPayoutsService, ConfigurationsService],
  exports: [BusinessReferralPayoutsService],
})
export class BusinessReferralPayoutsModule {}

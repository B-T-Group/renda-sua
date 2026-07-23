import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { BusinessReferralPayoutsInternalController } from './business-referral-payouts-internal.controller';
import { BusinessReferralPayoutsService } from './business-referral-payouts.service';

@Module({
  imports: [ConfigModule, NotificationsModule, StripePaymentsModule],
  controllers: [BusinessReferralPayoutsInternalController],
  providers: [BusinessReferralPayoutsService, ConfigurationsService],
  exports: [BusinessReferralPayoutsService],
})
export class BusinessReferralPayoutsModule {}

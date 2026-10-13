import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { LaunchPromoModule } from '../launch-promo/launch-promo.module';
import { MobilePaymentsPayoutModule } from '../mobile-payments/mobile-payments-payout.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { RepresentativeCommissionModule } from '../representative-commission/representative-commission.module';
import { CommissionsService } from './commissions.service';

@Module({
  imports: [
    AccountsModule,
    HasuraModule,
    LaunchPromoModule,
    MobilePaymentsPayoutModule,
    NotificationsModule,
    StripePaymentsModule,
    RepresentativeCommissionModule,
  ],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}

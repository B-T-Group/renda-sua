import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { HasuraModule } from '../hasura/hasura.module';
import { MobilePaymentsPayoutModule } from '../mobile-payments/mobile-payments-payout.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { CommissionsService } from './commissions.service';

@Module({
  imports: [
    AccountsModule,
    HasuraModule,
    MobilePaymentsPayoutModule,
    NotificationsModule,
    StripePaymentsModule,
  ],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from '../agents/agents.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { BusinessReferralsService } from './business-referrals.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    AgentsModule,
    NotificationsModule,
    StripePaymentsModule,
  ],
  providers: [BusinessReferralsService],
  exports: [BusinessReferralsService],
})
export class BusinessReferralsModule {}

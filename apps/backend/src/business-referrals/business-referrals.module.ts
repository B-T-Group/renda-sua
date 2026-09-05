import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from '../agents/agents.module';
import { HasuraModule } from '../hasura/hasura.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { ConfigurationsService } from '../admin/configurations.service';
import { BusinessReferralsService } from './business-referrals.service';

@Module({
  imports: [
    ConfigModule,
    HasuraModule,
    forwardRef(() => AgentsModule),
    NotificationsModule,
    StripePaymentsModule,
  ],
  providers: [BusinessReferralsService, ConfigurationsService],
  exports: [BusinessReferralsService],
})
export class BusinessReferralsModule {}

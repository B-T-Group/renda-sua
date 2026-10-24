import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { BusinessReferralsModule } from '../business-referrals/business-referrals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { BusinessTokenGiftsService } from './business-token-gifts.service';
import { BusinessTokensController } from './business-tokens.controller';
import { BusinessTokensService } from './business-tokens.service';
import { TokenPaymentCallbackHandler } from './token-payment-callback.handler';

@Module({
  imports: [
    StripePaymentsModule,
    BusinessReferralsModule,
    AgentsModule,
    NotificationsModule,
  ],
  controllers: [BusinessTokensController],
  providers: [
    BusinessTokensService,
    BusinessTokenGiftsService,
    TokenPaymentCallbackHandler,
  ],
  exports: [BusinessTokensService, TokenPaymentCallbackHandler],
})
export class BusinessTokensModule {}

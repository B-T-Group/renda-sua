import { Module } from '@nestjs/common';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { BusinessTokensController } from './business-tokens.controller';
import { BusinessTokensService } from './business-tokens.service';
import { TokenPaymentCallbackHandler } from './token-payment-callback.handler';

@Module({
  imports: [StripePaymentsModule],
  controllers: [BusinessTokensController],
  providers: [BusinessTokensService, TokenPaymentCallbackHandler],
  exports: [BusinessTokensService, TokenPaymentCallbackHandler],
})
export class BusinessTokensModule {}

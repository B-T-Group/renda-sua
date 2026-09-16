import { Module } from '@nestjs/common';
import { StripePaymentsModule } from '../stripe-payments/stripe-payments.module';
import { ReelAiTokenPaymentCallbackHandler } from './reel-ai-token-payment-callback.handler';
import { ReelAiTokensController } from './reel-ai-tokens.controller';
import { ReelAiTokensService } from './reel-ai-tokens.service';

@Module({
  imports: [StripePaymentsModule],
  controllers: [ReelAiTokensController],
  providers: [ReelAiTokensService, ReelAiTokenPaymentCallbackHandler],
  exports: [ReelAiTokensService, ReelAiTokenPaymentCallbackHandler],
})
export class ReelAiTokensModule {}

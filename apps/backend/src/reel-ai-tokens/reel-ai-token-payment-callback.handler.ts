import { Injectable, Logger } from '@nestjs/common';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { ReelAiTokensService } from './reel-ai-tokens.service';

@Injectable()
export class ReelAiTokenPaymentCallbackHandler
  implements PaymentCallbackHandler
{
  private readonly logger = new Logger(
    ReelAiTokenPaymentCallbackHandler.name
  );

  constructor(private readonly reelAiTokensService: ReelAiTokensService) {}

  supportsPaymentEntity(paymentEntity: string | undefined): boolean {
    return paymentEntity === 'reel_ai_token';
  }

  async finalizeCashReconciliationAfterPayment(
    _transaction: MobilePaymentTransaction
  ): Promise<void> {
    return;
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    await this.reelAiTokensService.processPaymentSuccess(transaction);
  }

  async onPaymentFailure(
    transaction: MobilePaymentTransaction,
    message: string
  ): Promise<void> {
    this.logger.log(
      `AI reel token pack payment FAILED for business ${
        transaction.entity_id || transaction.reference
      }: ${message}`
    );
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { BusinessTokensService } from './business-tokens.service';

@Injectable()
export class TokenPaymentCallbackHandler implements PaymentCallbackHandler {
  private readonly logger = new Logger(TokenPaymentCallbackHandler.name);

  constructor(private readonly businessTokensService: BusinessTokensService) {}

  supportsPaymentEntity(paymentEntity: string | undefined): boolean {
    return paymentEntity === 'token';
  }

  async finalizeCashReconciliationAfterPayment(
    _transaction: MobilePaymentTransaction
  ): Promise<void> {
    return;
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    await this.businessTokensService.processTokenPaymentSuccess(transaction);
  }

  async onPaymentFailure(
    transaction: MobilePaymentTransaction,
    message: string
  ): Promise<void> {
    this.logger.log(
      `Token pack payment FAILED for business ${
        transaction.entity_id || transaction.reference
      }: ${message}`
    );
  }
}

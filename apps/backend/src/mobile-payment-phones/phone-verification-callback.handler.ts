import { Injectable, Logger } from '@nestjs/common';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { MobilePaymentPhonesService } from './mobile-payment-phones.service';

@Injectable()
export class PhoneVerificationCallbackHandler implements PaymentCallbackHandler {
  private readonly logger = new Logger(PhoneVerificationCallbackHandler.name);

  constructor(
    private readonly mobilePaymentPhonesService: MobilePaymentPhonesService
  ) {}

  supportsPaymentEntity(paymentEntity: string | undefined): boolean {
    return paymentEntity === 'phone_verification';
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    const phoneId = transaction.entity_id?.trim();
    if (!phoneId) {
      this.logger.error(
        `Phone verification success missing entity_id on tx ${transaction.id}`
      );
      return;
    }
    await this.mobilePaymentPhonesService.completeVerificationFromTransaction(
      phoneId,
      transaction.id
    );
  }

  async onPaymentFailure(
    transaction: MobilePaymentTransaction,
    message: string
  ): Promise<void> {
    this.logger.log(
      `Phone verification payment failed for ${transaction.entity_id}: ${message}`
    );
  }

  async finalizeCashReconciliationAfterPayment(): Promise<void> {
    // Not applicable
  }
}

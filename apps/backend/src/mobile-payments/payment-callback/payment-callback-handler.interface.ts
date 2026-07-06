import type { MobilePaymentTransaction } from '../mobile-payments-database.service';

export const PAYMENT_CALLBACK_HANDLERS = Symbol('PAYMENT_CALLBACK_HANDLERS');

export interface PaymentCallbackHandler {
  supportsPaymentEntity(paymentEntity: string | undefined): boolean;
  finalizeCashReconciliationAfterPayment(
    transaction: MobilePaymentTransaction
  ): Promise<void>;
  onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void>;
  onPaymentAuthorized?(transaction: MobilePaymentTransaction): Promise<void>;
  onPaymentFailure(
    transaction: MobilePaymentTransaction,
    message: string
  ): Promise<void>;
}

export function findPaymentCallbackHandler(
  handlers: PaymentCallbackHandler[],
  paymentEntity: string | undefined
): PaymentCallbackHandler | undefined {
  return handlers.find((handler) =>
    handler.supportsPaymentEntity(paymentEntity)
  );
}

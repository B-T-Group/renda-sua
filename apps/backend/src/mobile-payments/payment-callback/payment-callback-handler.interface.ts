import type { MobilePaymentTransaction } from '../mobile-payments-database.service';

export const PAYMENT_CALLBACK_HANDLERS = Symbol('PAYMENT_CALLBACK_HANDLERS');

export interface PaymentCallbackHandler {
  supportsPaymentEntity(paymentEntity: string | undefined): boolean;
  finalizeCashReconciliationAfterPayment(
    transaction: MobilePaymentTransaction
  ): Promise<void>;
  onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void>;
  onPaymentAuthorized?(transaction: MobilePaymentTransaction): Promise<void>;
  /**
   * Provider SUCCESS arrived for an attempt we had cancelled as superseded (#545), or
   * for a plain attempt we had marked failed (F3 declined-then-approved, M1).
   * The amount is already credited to the payer wallet. Returns whether the payment
   * was applied to the entity (first success wins) or kept as a wallet credit.
   */
  onLateSuccessAfterSupersede?(
    transaction: MobilePaymentTransaction
  ): Promise<'applied' | 'duplicate'>;
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

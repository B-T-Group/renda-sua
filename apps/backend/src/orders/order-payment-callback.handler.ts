import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { safeErrorMessage } from '../common/utils/safe-error-log.util';

const ORDER_ENTITIES = new Set([
  'order',
  'claim_order',
  'order_cash_reconciliation',
  'order_deposit',
]);

/** Order statuses after which a MoMo failure must not touch the order (QA #597 F1). */
const FINISHED_ORDER_STATUSES = new Set(['cancelled', 'failed', 'refunded', 'complete']);

/**
 * QA #597 F1: the order is still waiting for this MoMo payment: not cancelled or finished,
 * and not paid. payment_status `pending`, or `failed` from an earlier attempt (retries do not
 * reset it, so a failed retry must still notify). Pay-now (`pending_payment`) and pay-later
 * orders (confirmed / ready_for_pickup / out_for_delivery) both qualify.
 */
export function isOrderAwaitingMomoPayment(order: {
  current_status?: string | null;
  payment_status?: string | null;
}): boolean {
  if (!order) return false;
  if (FINISHED_ORDER_STATUSES.has(String(order.current_status))) return false;
  return order.payment_status === 'pending' || order.payment_status === 'failed';
}

@Injectable()
export class OrderPaymentCallbackHandler implements PaymentCallbackHandler {
  private readonly logger = new Logger(OrderPaymentCallbackHandler.name);

  constructor(private readonly ordersService: OrdersService) {}

  supportsPaymentEntity(paymentEntity: string | undefined): boolean {
    return !!paymentEntity && ORDER_ENTITIES.has(paymentEntity);
  }

  async finalizeCashReconciliationAfterPayment(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    await this.ordersService.finalizeCashExceptionReconciliationAfterMobilePayment(
      transaction
    );
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    if (transaction.payment_entity === 'order_deposit') {
      const orderNumber = transaction.entity_id;
      if (!orderNumber) {
        this.logger.error('Deposit callback missing order number (entity_id)');
        return;
      }
      // Pass DB uuid (transaction.id) for FK to mobile_payment_transactions.id
      // Place-order already set deposit_mobile_payment_transaction_id correctly
      await this.ordersService.finalizeDepositAfterCallback(
        orderNumber,
        transaction.id
      );
      return;
    }
    if (transaction.payment_entity === 'order') {
      await this.ordersService.finalizeOrderAfterIncomingPayment(transaction);
      // #545 QA F2: no live attempt may stay pending on a paid order.
      await this.ordersService.closeOtherPendingAttemptsAfterSuccess(transaction);
      return;
    }
    if (transaction.payment_entity === 'claim_order') {
      await this.ordersService.processClaimOrderPayment(transaction);
    }
  }

  async onLateSuccessAfterSupersede(
    transaction: MobilePaymentTransaction
  ): Promise<'applied' | 'duplicate'> {
    return this.ordersService.handleLateSuccessOnSupersededOrderTx(transaction);
  }

  async onPaymentAuthorized(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    if (transaction.payment_entity === 'order') {
      await this.ordersService.finalizeOrderAfterAuthorization(transaction);
    }
  }

  async onPaymentFailure(
    transaction: MobilePaymentTransaction,
    message: string
  ): Promise<void> {
    if (transaction.payment_entity === 'order_deposit') {
      this.logger.log(
        `Deposit payment failed for order ${transaction.entity_id}: ${message}`
      );
      // Deposit failure = order cannot proceed - mark deposit failed and cancel order
      const orderNumber = transaction.entity_id || transaction.reference;
      const order = await this.ordersService.getOrderForProcessingByNumber(
        orderNumber
      );
      await this.ordersService.onDepositPaymentFailed(order.id, message);
      return;
    }
    if (transaction.payment_entity === 'order_cash_reconciliation') {
      this.logger.log(
        `Cash exception reconciliation payment failed for order ${
          transaction.entity_id || transaction.reference || 'unknown'
        }`
      );
      return;
    }
    if (transaction.payment_entity === 'order') {
      const orderNumber = transaction.entity_id || transaction.reference;
      const order = await this.ordersService.getOrderForProcessingByNumber(
        orderNumber
      );
      // QA #597 F1: a MoMo failure (e.g. FedaPay expiry ~24h later) only fails the order
      // while the order is still waiting for this payment. Stripe and other callers of
      // onOrderPaymentFailed are not routed through here and keep their behaviour.
      if (!isOrderAwaitingMomoPayment(order)) {
        this.logger.log(
          `momo_failure_ignored order=${order.order_number} status=${order.current_status} payment_status=${(order as any).payment_status} tx=${transaction.id}`
        );
        return;
      }
      await this.ordersService.onOrderPaymentFailed(order.id, message);
      return;
    }
    if (transaction.payment_entity === 'claim_order') {
      this.logger.log(
        `Claim order payment failed for order ${transaction.reference}`
      );
      // Emit topup failed event (Phase 0 #453)
      void this.ordersService.emitClaimTopupFailed(
        transaction,
        message
      ).catch((error) => {
        this.logger.error('Failed to emit claim topup failed event', safeErrorMessage(error));
      });
    }
  }
}

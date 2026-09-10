import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { DepositRefundService } from './deposit-refund.service';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';

const ORDER_ENTITIES = new Set([
  'order',
  'claim_order',
  'order_cash_reconciliation',
  'order_deposit',
  'order_deposit_refund',
]);

@Injectable()
export class OrderPaymentCallbackHandler implements PaymentCallbackHandler {
  private readonly logger = new Logger(OrderPaymentCallbackHandler.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly depositRefundService: DepositRefundService
  ) {}

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

  private async completeDepositRefundFromCallback(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    const orderId = transaction.entity_id;
    if (!orderId) {
      this.logger.error('Deposit refund callback missing order id (entity_id)');
      return;
    }
    await this.depositRefundService.completeDepositRefund(orderId, transaction.id);
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    if (transaction.payment_entity === 'order_deposit_refund') {
      await this.completeDepositRefundFromCallback(transaction);
      return;
    }
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
      return;
    }
    if (transaction.payment_entity === 'claim_order') {
      await this.ordersService.processClaimOrderPayment(transaction);
    }
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
    if (transaction.payment_entity === 'order_deposit_refund') {
      const orderId = transaction.entity_id;
      if (orderId) {
        await this.depositRefundService.markRefundFailed(orderId, message);
      }
      return;
    }
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
      await this.ordersService.onOrderPaymentFailed(order.id, message);
      return;
    }
    if (transaction.payment_entity === 'claim_order') {
      this.logger.log(
        `Claim order payment failed for order ${transaction.reference}`
      );
    }
  }
}

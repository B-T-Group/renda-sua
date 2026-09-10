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

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    if (transaction.payment_entity === 'order_deposit') {
      await this.handleOrderDepositSuccess(transaction);
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
    if (transaction.payment_entity === 'order_deposit') {
      await this.handleOrderDepositFailure(transaction, message);
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

  private async handleOrderDepositSuccess(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    const orderNumber = transaction.entity_id;
    if (!orderNumber) {
      this.logger.error('Deposit callback missing order number (entity_id)');
      return;
    }
    if (transaction.transaction_type === 'GIVE_CHANGE') {
      await this.completeDepositRefundPayout(orderNumber, transaction.id);
      return;
    }
    await this.ordersService.finalizeDepositAfterCallback(
      orderNumber,
      transaction.id
    );
  }

  private async completeDepositRefundPayout(
    orderNumber: string,
    transactionId: string
  ): Promise<void> {
    const order = await this.ordersService.getOrderForProcessingByNumber(
      orderNumber
    );
    await this.depositRefundService.completeDepositRefund(order.id, transactionId);
  }

  private async handleOrderDepositFailure(
    transaction: MobilePaymentTransaction,
    message: string
  ): Promise<void> {
    if (transaction.transaction_type === 'GIVE_CHANGE') {
      this.logger.log(
        `Deposit refund payout failed for ${transaction.entity_id}: ${message}`
      );
      return;
    }
    const orderNumber = transaction.entity_id || transaction.reference;
    const order = await this.ordersService.getOrderForProcessingByNumber(
      orderNumber
    );
    if (!this.shouldFailPendingDeposit(order, transaction)) {
      this.logger.log(`Ignoring stale deposit failure for ${orderNumber}`);
      return;
    }
    await this.ordersService.onDepositPaymentFailed(order.id, message);
  }

  private shouldFailPendingDeposit(
    order: {
      current_status?: string;
      deposit_status?: string;
      deposit_mobile_payment_transaction_id?: string;
    },
    transaction: MobilePaymentTransaction
  ): boolean {
    if (order.current_status !== 'pending_payment') return false;
    if (order.deposit_status !== 'pending') return false;
    const currentTxnId = order.deposit_mobile_payment_transaction_id;
    if (currentTxnId && transaction.id && currentTxnId !== transaction.id) {
      return false;
    }
    return true;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { OrdersService } from './orders.service';

const ORDER_ENTITIES = new Set([
  'order',
  'claim_order',
  'order_cash_reconciliation',
]);

@Injectable()
export class OrderPaymentCallbackHandler implements PaymentCallbackHandler {
  private readonly logger = new Logger(OrderPaymentCallbackHandler.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  private resolveOrdersService(): Promise<OrdersService> {
    return this.moduleRef.resolve(OrdersService);
  }

  supportsPaymentEntity(paymentEntity: string | undefined): boolean {
    return !!paymentEntity && ORDER_ENTITIES.has(paymentEntity);
  }

  async finalizeCashReconciliationAfterPayment(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    const ordersService = await this.resolveOrdersService();
    await ordersService.finalizeCashExceptionReconciliationAfterMobilePayment(
      transaction
    );
  }

  async onPaymentSuccess(transaction: MobilePaymentTransaction): Promise<void> {
    const ordersService = await this.resolveOrdersService();
    if (transaction.payment_entity === 'order') {
      await ordersService.finalizeOrderAfterIncomingPayment(transaction);
      return;
    }
    if (transaction.payment_entity === 'claim_order') {
      await ordersService.processClaimOrderPayment(transaction);
    }
  }

  async onPaymentFailure(
    transaction: MobilePaymentTransaction,
    message: string
  ): Promise<void> {
    if (transaction.payment_entity === 'order_cash_reconciliation') {
      this.logger.log(
        `Cash exception reconciliation payment failed for order ${
          transaction.entity_id || transaction.reference || 'unknown'
        }`
      );
      return;
    }
    const ordersService = await this.resolveOrdersService();
    if (transaction.payment_entity === 'order') {
      const orderNumber = transaction.entity_id || transaction.reference;
      const order = await ordersService.getOrderByNumber(orderNumber);
      await ordersService.onOrderPaymentFailed(order.id, message);
      return;
    }
    if (transaction.payment_entity === 'claim_order') {
      this.logger.log(
        `Claim order payment failed for order ${transaction.reference}`
      );
    }
  }
}

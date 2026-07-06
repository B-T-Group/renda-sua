import { Injectable, Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { PaymentCallbackHandler } from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';

const ORDER_ENTITIES = new Set([
  'order',
  'claim_order',
  'order_cash_reconciliation',
]);

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

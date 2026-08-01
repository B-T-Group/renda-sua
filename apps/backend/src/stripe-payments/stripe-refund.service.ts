import { Injectable, Logger } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';

@Injectable()
export class StripeRefundService {
  private readonly logger = new Logger(StripeRefundService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly databaseService: StripePaymentsDatabaseService
  ) {}

  async initiateOrderRefund(params: {
    orderId: string;
    orderNumber: string;
    cancellationFee: number;
    cancelledBy: string;
  }): Promise<{ success: boolean; refundId?: string; message: string }> {
    return this.executeStripeRefund({
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      amount: undefined,
      cancellationFee: params.cancellationFee,
      cancelledBy: params.cancelledBy,
      refundType: 'cancellation',
      idempotencyKey: `refund_${params.orderId}`,
    });
  }

  async initiatePostDeliveryRefund(params: {
    orderId: string;
    orderNumber: string;
    amount: number;
    refundRequestId: string;
    refundPaymentId: string;
    refundType: 'post_delivery_full' | 'post_delivery_partial' | 'force_admin';
    idempotencyKey: string;
  }): Promise<{
    success: boolean;
    refundId?: string;
    stripeRefundDbId?: string;
    immediateSuccess?: boolean;
    message: string;
  }> {
    const result = await this.executeStripeRefund({
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      amount: params.amount,
      cancellationFee: 0,
      cancelledBy: undefined,
      refundType: params.refundType,
      idempotencyKey: params.idempotencyKey,
      refundRequestId: params.refundRequestId,
      refundPaymentId: params.refundPaymentId,
    });
    return {
      success: result.success,
      refundId: result.refundId,
      stripeRefundDbId: result.stripeRefundDbId,
      immediateSuccess: result.immediateSuccess,
      message: result.message,
    };
  }

  private async executeStripeRefund(params: {
    orderId: string;
    orderNumber: string;
    amount?: number;
    cancellationFee: number;
    cancelledBy?: string;
    refundType: 'cancellation' | 'post_delivery_full' | 'post_delivery_partial' | 'force_admin';
    idempotencyKey: string;
    refundRequestId?: string;
    refundPaymentId?: string;
  }): Promise<{
    success: boolean;
    refundId?: string;
    stripeRefundDbId?: string;
    immediateSuccess?: boolean;
    message: string;
  }> {
    try {
      this.logger.log(
        `Initiating Stripe refund for order ${params.orderNumber} (${params.orderId}), type ${params.refundType}`
      );

      const transaction = await this.databaseService.getTransactionByEntityId(
        params.orderNumber
      );

      if (!transaction) {
        this.logger.warn(
          `No Stripe payment transaction found for order ${params.orderNumber}`
        );
        return {
          success: false,
          message: 'No Stripe payment transaction found for this order',
        };
      }

      if (!transaction.stripe_payment_intent_id) {
        return {
          success: false,
          message: 'No payment intent ID found for this transaction',
        };
      }

      const localUncaptured =
        transaction.status === 'authorized' ||
        transaction.status === 'capture_pending';
      if (localUncaptured) {
        if (params.refundType !== 'cancellation') {
          return {
            success: false,
            message: 'Cannot post-delivery refund an uncaptured authorization',
          };
        }
        return this.cancelUncapturedAuthorization(
          transaction.id,
          transaction.stripe_payment_intent_id,
          params.orderId,
          params.orderNumber
        );
      }

      // DB may say success while Stripe still holds an uncaptured PI (status drift).
      const pi = await this.stripeService.retrievePaymentIntent(
        transaction.stripe_payment_intent_id
      );
      if (pi.status === 'requires_capture') {
        if (params.refundType !== 'cancellation') {
          return {
            success: false,
            message: 'Cannot post-delivery refund an uncaptured authorization',
          };
        }
        this.logger.warn(
          `Order ${params.orderNumber} tx=${transaction.status} but PI requires_capture; cancelling authorization`
        );
        return this.cancelUncapturedAuthorization(
          transaction.id,
          transaction.stripe_payment_intent_id,
          params.orderId,
          params.orderNumber
        );
      }
      if (pi.status === 'canceled') {
        await this.databaseService.updateTransaction(transaction.id, {
          status: 'cancelled',
          error_message: 'PaymentIntent already canceled on Stripe',
        });
        return {
          success: true,
          message: 'Payment authorization already released',
        };
      }

      if (transaction.status !== 'success' && transaction.status !== 'refunded') {
        this.logger.warn(
          `Stripe payment transaction for order ${params.orderNumber} is not refundable: ${transaction.status}`
        );
        return {
          success: false,
          message: `Cannot refund order with payment status: ${transaction.status}`,
        };
      }

      const alreadyRefunded = await this.databaseService.sumSucceededRefundsForOrder(
        params.orderId
      );
      const maxRefundable = Math.max(0, transaction.amount - alreadyRefunded);
      const requestedAmount =
        params.amount ?? Math.max(0, transaction.amount - params.cancellationFee);
      const refundAmount = Math.min(requestedAmount, maxRefundable);

      if (refundAmount <= 0) {
        return {
          success: true,
          message: 'No refund needed (amount is zero or already fully refunded)',
        };
      }

      const refundAmountMinor = this.toMinorUnits(refundAmount, transaction.currency);

      const refundRecord = await this.databaseService.createRefundRecord({
        stripe_payment_intent_id: transaction.stripe_payment_intent_id,
        stripe_payment_transaction_id: transaction.id,
        order_id: params.orderId,
        amount: refundAmount,
        currency: transaction.currency,
        reason: 'requested_by_customer',
        cancellation_fee: params.cancellationFee,
        cancelled_by: params.cancelledBy ?? null,
        refund_type: params.refundType,
        refund_request_id: params.refundRequestId ?? null,
        refund_payment_id: params.refundPaymentId ?? null,
        metadata: {
          orderId: params.orderId,
          orderNumber: params.orderNumber,
          refundType: params.refundType,
        },
      });

      try {
        const stripeRefund = await this.stripeService.createRefund({
          paymentIntentId: transaction.stripe_payment_intent_id,
          amount: refundAmountMinor,
          reason: 'requested_by_customer',
          metadata: {
            orderId: params.orderId,
            orderNumber: params.orderNumber,
            refundType: params.refundType,
            refundPaymentId: params.refundPaymentId ?? '',
          },
          idempotencyKey: params.idempotencyKey,
        });

        await this.databaseService.linkStripeRefundRecord(
          refundRecord.id,
          stripeRefund.id,
          stripeRefund.status === 'succeeded' ? 'succeeded' : 'pending'
        );

        this.logger.log(
          `Stripe refund created: ${stripeRefund.id} for order ${params.orderNumber}`
        );

        return {
          success: true,
          refundId: stripeRefund.id,
          stripeRefundDbId: refundRecord.id,
          immediateSuccess: stripeRefund.status === 'succeeded',
          message: `Refund initiated: ${refundAmount} ${transaction.currency}`,
        };
      } catch (refundError: any) {
        if (
          params.refundType === 'cancellation' &&
          this.isUncapturedChargeRefundError(refundError)
        ) {
          this.logger.warn(
            `Refund rejected for uncaptured PI on order ${params.orderNumber}; cancelling authorization`
          );
          return this.cancelUncapturedAuthorization(
            transaction.id,
            transaction.stripe_payment_intent_id,
            params.orderId,
            params.orderNumber
          );
        }
        throw refundError;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to initiate Stripe refund for order ${params.orderNumber}: ${error.message}`,
        error.stack
      );
      return {
        success: false,
        message: `Failed to initiate refund: ${error.message}`,
      };
    }
  }

  private async cancelUncapturedAuthorization(
    transactionId: string,
    paymentIntentId: string,
    orderId: string,
    orderNumber: string
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Cancelling uncaptured PaymentIntent for order ${orderNumber} (${paymentIntentId})`
    );
    await this.stripeService.cancelPaymentIntent(
      paymentIntentId,
      `cancel_refund_${orderId}`
    );
    await this.databaseService.updateTransaction(transactionId, {
      status: 'cancelled',
      error_message: 'Authorization cancelled on order cancellation',
    });
    return {
      success: true,
      message: 'Payment authorization released (no charge was made)',
    };
  }

  private isUncapturedChargeRefundError(error: any): boolean {
    const msg = String(error?.message || error || '').toLowerCase();
    return (
      msg.includes('uncaptured charge') ||
      msg.includes('cancel the paymentintent') ||
      msg.includes('cancel the payment intent') ||
      (msg.includes('requires_capture') && msg.includes('refund'))
    );
  }

  private toMinorUnits(amount: number, currency: string): number {
    const zeroDecimal = new Set(['XAF', 'XOF', 'JPY', 'KRW', 'VND', 'CLP']);
    if (zeroDecimal.has(currency.toUpperCase())) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }
}

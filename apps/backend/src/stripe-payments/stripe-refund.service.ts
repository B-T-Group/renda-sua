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
    orderNumber: string;
    cancellationFee: number;
    cancelledBy: string;
  }): Promise<{ success: boolean; refundId?: string; message: string }> {
    try {
      this.logger.log(
        `Initiating Stripe refund for order ${params.orderNumber}, cancelled by ${params.cancelledBy}`
      );

      // Look up the successful Stripe payment transaction by order number
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

      if (transaction.status !== 'success') {
        this.logger.warn(
          `Stripe payment transaction for order ${params.orderNumber} is not in success status: ${transaction.status}`
        );
        return {
          success: false,
          message: `Cannot refund order with payment status: ${transaction.status}`,
        };
      }

      if (!transaction.stripe_payment_intent_id) {
        this.logger.warn(
          `No payment intent ID found for transaction ${transaction.id}`
        );
        return {
          success: false,
          message: 'No payment intent ID found for this transaction',
        };
      }

      // Calculate refund amount (total paid minus cancellation fee)
      const refundAmount = Math.max(0, transaction.amount - params.cancellationFee);

      if (refundAmount <= 0) {
        this.logger.log(
          `Refund amount is zero or negative for order ${params.orderNumber}, skipping Stripe refund`
        );
        return {
          success: true,
          message: 'No refund needed (cancellation fee covers full amount)',
        };
      }

      // Convert to minor units (cents for most currencies)
      const refundAmountMinor = this.toMinorUnits(refundAmount, transaction.currency);

      // Create the refund via Stripe API
      const stripeRefund = await this.stripeService.createRefund({
        paymentIntentId: transaction.stripe_payment_intent_id,
        amount: refundAmountMinor,
        reason: 'requested_by_customer',
        metadata: {
          orderNumber: params.orderNumber,
          cancelledBy: params.cancelledBy,
        },
      });

      this.logger.log(
        `Stripe refund created: ${stripeRefund.id} for order ${params.orderNumber}`
      );

      // Insert refund record into database with pending status
      const refundRecord = await this.databaseService.createRefundRecord({
        stripe_refund_id: stripeRefund.id,
        stripe_payment_intent_id: transaction.stripe_payment_intent_id,
        stripe_payment_transaction_id: transaction.id,
        order_id: params.orderNumber,
        amount: refundAmount,
        currency: transaction.currency,
        reason: 'requested_by_customer',
        cancellation_fee: params.cancellationFee,
        cancelled_by: params.cancelledBy,
        metadata: {
          orderNumber: params.orderNumber,
          cancelledBy: params.cancelledBy,
        },
      });

      this.logger.log(
        `Refund record created: ${refundRecord.id} for order ${params.orderNumber}`
      );

      return {
        success: true,
        refundId: stripeRefund.id,
        message: `Refund initiated: ${refundAmount} ${transaction.currency}`,
      };
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

  private toMinorUnits(amount: number, currency: string): number {
    const zeroDecimal = new Set(['XAF', 'XOF', 'JPY', 'KRW', 'VND', 'CLP']);
    if (zeroDecimal.has(currency.toUpperCase())) {
      return Math.round(amount);
    }
    return Math.round(amount * 100);
  }
}

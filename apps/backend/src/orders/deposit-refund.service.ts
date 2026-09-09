import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { MobilePaymentsService } from '../mobile-payments/mobile-payments.service';
import { DepositCalculationService } from './deposit-calculation.service';

/**
 * Deposit forfeit reason codes (immutable audit trail)
 */
export type DepositForfeitReason =
  | 'customer_cancel_after_lock'
  | 'customer_refuse_delivery'
  | 'customer_no_show_pickup'
  | 'customer_no_show_delivery';

export interface DepositRefundResult {
  success: boolean;
  transactionId?: string;
  message?: string;
  errorCode?: string;
}

@Injectable()
export class DepositRefundService {
  private readonly logger = new Logger(DepositRefundService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly depositCalculationService: DepositCalculationService
  ) {}

  /**
   * Attempt to refund deposit via MoMo withdraw.
   * Safe to call before lock point only.
   * 
   * @param orderId Order UUID
   * @returns Refund result with transaction ID
   */
  async refundDeposit(orderId: string): Promise<DepositRefundResult> {
    try {
      // Fetch order with deposit info
      const order = await this.getOrderWithDeposit(orderId);

      if (!order) {
        return {
          success: false,
          message: 'Order not found',
          errorCode: 'ORDER_NOT_FOUND',
        };
      }

      // Validate deposit is eligible for refund
      const eligibility = this.validateRefundEligibility(order);
      if (!eligibility.eligible) {
        return {
          success: false,
          message: eligibility.reason,
          errorCode: eligibility.code,
        };
      }

      // Check lock point
      const afterLock = this.depositCalculationService.isAfterRefundLockPoint(
        order.fulfillment_method,
        order.current_status
      );

      if (afterLock) {
        return {
          success: false,
          message:
            'Order has passed refund lock point. Deposit can only be forfeited.',
          errorCode: 'AFTER_LOCK_POINT',
        };
      }

      // Initiate MoMo withdrawal to customer phone
      const withdrawalRequest = {
        amount: order.deposit_amount,
        currency: order.currency,
        description: `Deposit refund for order ${order.order_number}`,
        customerPhone: order.recipient_phone || order.payer_phone,
        itemCountry: order.business_location_country,
        transactionType: 'GIVE_CHANGE' as const,
      };

      const withdrawalResult = await this.mobilePaymentsService.initiatePayment(
        withdrawalRequest,
        `DEPREF-${order.order_number}-${Date.now()}`
      );

      if (!withdrawalResult.success) {
        // Mark refund attempt failed
        await this.markRefundAttempted(
          orderId,
          null,
          'failed',
          withdrawalResult.message
        );

        return {
          success: false,
          message: withdrawalResult.message || 'Refund initiation failed',
          errorCode: withdrawalResult.errorCode || 'WITHDRAWAL_FAILED',
        };
      }

      // Mark refund initiated
      await this.markRefundAttempted(
        orderId,
        withdrawalResult.transactionId,
        'pending'
      );

      return {
        success: true,
        transactionId: withdrawalResult.transactionId,
        message: 'Deposit refund initiated',
      };
    } catch (error: any) {
      this.logger.error(`Failed to refund deposit for order ${orderId}:`, error);
      return {
        success: false,
        message: error.message || 'Deposit refund failed',
        errorCode: 'REFUND_ERROR',
      };
    }
  }

  /**
   * Forfeit deposit with immutable reason code.
   * Called after lock point when customer cancels/refuses/no-shows.
   * 
   * @param orderId Order UUID
   * @param reason Forfeit reason code
   * @returns Success indicator
   */
  async forfeitDeposit(
    orderId: string,
    reason: DepositForfeitReason
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const order = await this.getOrderWithDeposit(orderId);

      if (!order) {
        return {
          success: false,
          message: 'Order not found',
        };
      }

      if (order.deposit_status !== 'paid') {
        return {
          success: false,
          message: 'No deposit to forfeit',
        };
      }

      if (order.deposit_forfeited_at) {
        return {
          success: false,
          message: 'Deposit already forfeited',
        };
      }

      // Mark deposit as forfeited
      const mutation = `
        mutation ForfeitDeposit($orderId: uuid!, $reason: String!, $now: timestamptz!) {
          update_orders_by_pk(
            pk_columns: { id: $orderId }
            _set: {
              deposit_status: "forfeited"
              deposit_forfeit_reason: $reason
              deposit_forfeited_at: $now
            }
          ) {
            id
          }
        }
      `;

      await this.hasuraSystemService.executeMutation(mutation, {
        orderId,
        reason,
        now: new Date().toISOString(),
      });

      this.logger.log(
        `Deposit forfeited for order ${order.order_number}: ${reason}`
      );

      return {
        success: true,
        message: 'Deposit forfeited',
      };
    } catch (error: any) {
      this.logger.error(`Failed to forfeit deposit for order ${orderId}:`, error);
      return {
        success: false,
        message: error.message || 'Deposit forfeit failed',
      };
    }
  }

  /**
   * Mark deposit refund as completed (called from callback handler)
   */
  async completeDepositRefund(
    orderId: string,
    transactionId: string
  ): Promise<void> {
    const mutation = `
      mutation CompleteDepositRefund($orderId: uuid!, $now: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            deposit_refund_status: "refunded"
            deposit_refunded_at: $now
            deposit_status: "refunded"
          }
        ) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      now: new Date().toISOString(),
    });

    this.logger.log(`Deposit refund completed for order ${orderId}`);
  }

  /**
   * Validate if deposit can be refunded
   */
  private validateRefundEligibility(order: any): {
    eligible: boolean;
    reason?: string;
    code?: string;
  } {
    if (!order.deposit_amount || order.deposit_amount <= 0) {
      return {
        eligible: false,
        reason: 'No deposit amount on order',
        code: 'NO_DEPOSIT',
      };
    }

    if (order.deposit_status !== 'paid') {
      return {
        eligible: false,
        reason: 'Deposit not yet captured',
        code: 'DEPOSIT_NOT_CAPTURED',
      };
    }

    if (order.deposit_status === 'refunded') {
      return {
        eligible: false,
        reason: 'Deposit already refunded',
        code: 'ALREADY_REFUNDED',
      };
    }

    if (order.deposit_status === 'forfeited') {
      return {
        eligible: false,
        reason: 'Deposit was forfeited',
        code: 'DEPOSIT_FORFEITED',
      };
    }

    if (
      order.deposit_refund_status === 'pending' ||
      order.deposit_refund_status === 'refunded'
    ) {
      return {
        eligible: false,
        reason: 'Refund already in progress or completed',
        code: 'REFUND_IN_PROGRESS',
      };
    }

    return { eligible: true };
  }

  /**
   * Mark refund attempt in database
   */
  private async markRefundAttempted(
    orderId: string,
    transactionId: string | null | undefined,
    status: 'pending' | 'failed',
    notes?: string
  ): Promise<void> {
    const mutation = `
      mutation MarkDepositRefundAttempted(
        $orderId: uuid!,
        $status: String!
      ) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            deposit_refund_status: $status
          }
        ) {
          id
        }
      }
    `;

    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      status,
    });

    if (notes) {
      this.logger.warn(
        `Deposit refund attempt ${status} for order ${orderId}: ${notes}`
      );
    }
  }

  /**
   * Fetch order with deposit information
   */
  private async getOrderWithDeposit(orderId: string): Promise<any> {
    const query = `
      query GetOrderWithDeposit($orderId: uuid!) {
        orders_by_pk(id: $orderId) {
          id
          order_number
          current_status
          fulfillment_method
          currency
          deposit_amount
          deposit_mobile_payment_transaction_id
          deposit_status
          deposit_refund_status
          deposit_forfeit_reason
          deposit_forfeited_at
          deposit_refunded_at
          recipient_phone
          payer_phone
          business_location {
            address {
              country
            }
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });

    const order = result.orders_by_pk;
    if (!order) {
      return null;
    }

    return {
      ...order,
      business_location_country: order.business_location?.address?.country,
    };
  }
}

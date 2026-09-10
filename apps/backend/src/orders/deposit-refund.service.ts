import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  GiveChangePayoutResult,
  GiveChangePayoutService,
} from '../mobile-payments/give-change-payout.service';
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
    private readonly giveChangePayoutService: GiveChangePayoutService,
    private readonly depositCalculationService: DepositCalculationService,
    private readonly accountsService: AccountsService
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

      if (this.isLockedForRefund(order)) {
        return {
          success: false,
          message:
            'Order has passed refund lock point. Deposit can only be forfeited.',
          errorCode: 'AFTER_LOCK_POINT',
        };
      }

      return this.initiateDepositRefundPayout(order);
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

      const reversed = await this.reverseDepositWalletCredit(order, 'forfeit');
      if (!reversed.success) {
        return { success: false, message: reversed.message };
      }

      await this.persistForfeit(orderId, reason);
      this.logger.log(
        `Deposit forfeited for order ${order.order_number}: ${reason}`
      );
      return { success: true, message: 'Deposit forfeited' };
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

    this.logger.log(
      `Deposit refund completed for order ${orderId} (txn ${transactionId})`
    );
  }

  private isLockedForRefund(order: any): boolean {
    return this.depositCalculationService.isAfterRefundLockPoint(
      order.fulfillment_method,
      order.current_status
    );
  }

  private async initiateDepositRefundPayout(
    order: any
  ): Promise<DepositRefundResult> {
    const account = await this.requireClientAccount(order);
    if ('error' in account) {
      return {
        success: false,
        message: account.error,
        errorCode: 'ACCOUNT_NOT_FOUND',
      };
    }
    const phone = String(order.recipient_phone || order.payer_phone || '').trim();
    if (!phone) {
      return {
        success: false,
        message: 'Phone number required for deposit refund',
        errorCode: 'PHONE_REQUIRED',
      };
    }
    return this.executeRefundPayout(order, account.id, phone);
  }

  private async executeRefundPayout(
    order: any,
    accountId: string,
    phone: string
  ): Promise<DepositRefundResult> {
    const payout = await this.giveChangePayoutService.executeGiveChangePayout(
      {
        amount: order.deposit_amount,
        currency: order.currency,
        description: `Deposit refund for order ${order.order_number}`,
        customerPhone: phone,
        accountId,
        entityId: order.order_number,
        paymentEntity: 'order_deposit',
      },
      { throwOnWithdrawalFailure: false }
    );
    return this.recordRefundPayoutResult(order.id, payout);
  }

  private async recordRefundPayoutResult(
    orderId: string,
    payout: GiveChangePayoutResult
  ): Promise<DepositRefundResult> {
    if (!payout.success) {
      await this.markRefundAttempted(
        orderId,
        null,
        'failed',
        'Refund payout initiation failed'
      );
      return {
        success: false,
        message: payout.data?.message || 'Refund initiation failed',
        errorCode: 'WITHDRAWAL_FAILED',
      };
    }
    await this.markRefundAttempted(orderId, payout.data?.transactionId, 'pending');
    return {
      success: true,
      transactionId: payout.data?.transactionId,
      message: 'Deposit refund initiated',
    };
  }

  private async persistForfeit(
    orderId: string,
    reason: DepositForfeitReason
  ): Promise<void> {
    const mutation = `
      mutation ForfeitDeposit($orderId: uuid!, $reason: String!, $now: timestamptz!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: {
            deposit_status: "forfeited"
            deposit_forfeit_reason: $reason
            deposit_forfeited_at: $now
          }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      orderId,
      reason,
      now: new Date().toISOString(),
    });
  }

  private async reverseDepositWalletCredit(
    order: any,
    reason: string
  ): Promise<{ success: boolean; message?: string }> {
    const account = await this.requireClientAccount(order);
    if ('error' in account) return { success: false, message: account.error };
    const result = await this.accountsService.registerWithdrawalIfNotExists({
      accountId: account.id,
      amount: order.deposit_amount,
      referenceId: order.id,
      memo: `Deposit ${reason} for order ${order.order_number}`,
    });
    if (result?.success) return { success: true };
    return { success: false, message: result?.error || 'Wallet reversal failed' };
  }

  private async requireClientAccount(
    order: any
  ): Promise<{ id: string } | { error: string }> {
    const userId = order.client?.user_id;
    if (!userId) return { error: 'Client user not found on order' };
    const account = await this.hasuraSystemService.getAccount(
      userId,
      order.currency
    );
    if (!account?.id) return { error: 'Client account not found' };
    return { id: account.id };
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
          client {
            user_id
          }
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

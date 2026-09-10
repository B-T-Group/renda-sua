import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DepositCalculationService } from './deposit-calculation.service';
import { DepositLedgerService } from './deposit-ledger.service';

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
  message?: string;
  errorCode?: string;
}

@Injectable()
export class DepositRefundService {
  private readonly logger = new Logger(DepositRefundService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly depositCalculationService: DepositCalculationService,
    private readonly depositLedgerService: DepositLedgerService
  ) {}

  /**
   * Refund deposit by releasing the wallet hold back to client available.
   * No MoMo withdraw — funds stay in the Rendasua wallet as available balance.
   */
  async refundDeposit(
    orderId: string,
    options?: { allowAfterLock?: boolean }
  ): Promise<DepositRefundResult> {
    try {
      const order = await this.getOrderWithDeposit(orderId);
      if (!order) {
        return {
          success: false,
          message: 'Order not found',
          errorCode: 'ORDER_NOT_FOUND',
        };
      }

      const eligibility = this.validateRefundEligibility(order);
      if (!eligibility.eligible) {
        return {
          success: false,
          message: eligibility.reason,
          errorCode: eligibility.code,
        };
      }

      const afterLock = this.depositCalculationService.isAfterRefundLockPoint(
        order.fulfillment_method,
        order.current_status
      );
      if (afterLock && !options?.allowAfterLock) {
        return {
          success: false,
          message:
            'Order has passed refund lock point. Deposit can only be forfeited.',
          errorCode: 'AFTER_LOCK_POINT',
        };
      }

      if (!order.deposit_mobile_payment_transaction_id) {
        return {
          success: false,
          message: 'Deposit payment transaction missing',
          errorCode: 'NO_DEPOSIT_TX',
        };
      }

      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client_user_id,
        order.currency
      );
      if (!clientAccount?.id) {
        return {
          success: false,
          message: 'Client account not found',
          errorCode: 'ACCOUNT_NOT_FOUND',
        };
      }

      await this.depositLedgerService.releaseDepositToAvailable({
        clientAccountId: clientAccount.id,
        amount: order.deposit_amount,
        orderNumber: order.order_number,
        depositTransactionId: order.deposit_mobile_payment_transaction_id,
      });

      await this.markDepositRefunded(orderId);

      this.logger.log(
        `Deposit refunded (hold released) for order ${order.order_number}`
      );

      return {
        success: true,
        message: 'Deposit refunded to client wallet',
      };
    } catch (error: any) {
      this.logger.error(`Failed to refund deposit for order ${orderId}:`, error);
      await this.markRefundFailed(orderId, error?.message);
      return {
        success: false,
        message: error.message || 'Deposit refund failed',
        errorCode: 'REFUND_ERROR',
      };
    }
  }

  /**
   * Forfeit deposit: move withheld funds to Rendasua HQ wallet.
   */
  async forfeitDeposit(
    orderId: string,
    reason: DepositForfeitReason
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const order = await this.getOrderWithDeposit(orderId);
      if (!order) {
        return { success: false, message: 'Order not found' };
      }

      if (order.deposit_status !== 'paid') {
        return { success: false, message: 'No deposit to forfeit' };
      }

      if (order.deposit_forfeited_at || order.deposit_status === 'forfeited') {
        return { success: false, message: 'Deposit already forfeited' };
      }

      if (!order.deposit_mobile_payment_transaction_id) {
        return {
          success: false,
          message: 'Deposit payment transaction missing',
        };
      }

      const clientAccount = await this.hasuraSystemService.getAccount(
        order.client_user_id,
        order.currency
      );
      if (!clientAccount?.id) {
        return { success: false, message: 'Client account not found' };
      }

      await this.depositLedgerService.forfeitDepositToHq({
        clientAccountId: clientAccount.id,
        amount: order.deposit_amount,
        currency: order.currency,
        orderNumber: order.order_number,
        depositTransactionId: order.deposit_mobile_payment_transaction_id,
      });

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

      return { success: true, message: 'Deposit forfeited to Rendasua' };
    } catch (error: any) {
      this.logger.error(`Failed to forfeit deposit for order ${orderId}:`, error);
      return {
        success: false,
        message: error.message || 'Deposit forfeit failed',
      };
    }
  }

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

    if (order.deposit_status !== 'paid') {
      return {
        eligible: false,
        reason: 'Deposit not yet captured',
        code: 'DEPOSIT_NOT_CAPTURED',
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

  private async markDepositRefunded(orderId: string): Promise<void> {
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
  }

  private async markRefundFailed(
    orderId: string,
    notes?: string
  ): Promise<void> {
    try {
      const mutation = `
        mutation MarkDepositRefundFailed($orderId: uuid!) {
          update_orders_by_pk(
            pk_columns: { id: $orderId }
            _set: { deposit_refund_status: "failed" }
          ) {
            id
          }
        }
      `;
      await this.hasuraSystemService.executeMutation(mutation, { orderId });
      if (notes) {
        this.logger.warn(
          `Deposit refund failed for order ${orderId}: ${notes}`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to mark deposit refund failed for ${orderId}: ${error?.message}`
      );
    }
  }

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
          client {
            user_id
          }
        }
      }
    `;

    const result = await this.hasuraSystemService.executeQuery(query, {
      orderId,
    });

    const order = result.orders_by_pk;
    if (!order) return null;

    return {
      ...order,
      client_user_id: order.client?.user_id,
    };
  }
}

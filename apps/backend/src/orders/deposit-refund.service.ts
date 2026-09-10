import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { GiveChangePayoutService } from '../mobile-payments/give-change-payout.service';
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

interface OrderWithDeposit {
  id: string;
  order_number: string;
  current_status: string;
  fulfillment_method: 'delivery' | 'pickup' | 'shipping';
  currency: string;
  deposit_amount: number;
  deposit_mobile_payment_transaction_id?: string | null;
  deposit_status: string;
  deposit_refund_status?: string | null;
  deposit_forfeit_reason?: string | null;
  deposit_forfeited_at?: string | null;
  recipient_phone?: string | null;
  payer_phone?: string | null;
  client?: { user_id?: string | null } | null;
  business_location_country?: string;
}

@Injectable()
export class DepositRefundService {
  private readonly logger = new Logger(DepositRefundService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly giveChangePayoutService: GiveChangePayoutService,
    private readonly accountsService: AccountsService,
    private readonly depositCalculationService: DepositCalculationService
  ) {}

  /**
   * Refund a captured deposit via tracked GIVE_CHANGE (hold + MoMo withdraw).
   * Safe to call before lock point only.
   */
  async refundDeposit(orderId: string): Promise<DepositRefundResult> {
    try {
      const order = await this.getOrderWithDeposit(orderId);
      if (!order) {
        return this.fail('Order not found', 'ORDER_NOT_FOUND');
      }
      const eligibility = this.validateRefundEligibility(order);
      if (!eligibility.eligible) {
        return this.fail(eligibility.reason, eligibility.code);
      }
      if (this.isAfterLock(order)) {
        return this.fail(
          'Order has passed refund lock point. Deposit can only be forfeited.',
          'AFTER_LOCK_POINT'
        );
      }
      return this.initiateTrackedDepositRefund(order);
    } catch (error: any) {
      this.logger.error(`Failed to refund deposit for order ${orderId}:`, error);
      return this.fail(error.message || 'Deposit refund failed', 'REFUND_ERROR');
    }
  }

  /**
   * Forfeit deposit: claw back the client wallet credit, then stamp reason.
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
      if (order.deposit_status !== 'paid' || order.deposit_forfeited_at) {
        return {
          success: false,
          message: order.deposit_forfeited_at
            ? 'Deposit already forfeited'
            : 'No deposit to forfeit',
        };
      }
      const clawed = await this.clawbackForfeitedDeposit(order);
      if (!clawed.success) {
        return clawed;
      }
      await this.markForfeited(orderId, reason);
      this.logger.log(
        `Deposit forfeited for order ${order.order_number}: ${reason}`
      );
      return { success: true, message: 'Deposit forfeited' };
    } catch (error: any) {
      this.logger.error(`Failed to forfeit deposit for order ${orderId}:`, error);
      return { success: false, message: error.message || 'Deposit forfeit failed' };
    }
  }

  /**
   * Mark deposit refund as completed (called from GIVE_CHANGE callback)
   */
  async completeDepositRefund(
    orderId: string,
    _transactionId: string
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

  async markRefundFailed(orderId: string, notes?: string): Promise<void> {
    await this.markRefundAttempted(orderId, 'failed', notes);
  }

  private fail(message?: string, errorCode?: string): DepositRefundResult {
    return { success: false, message, errorCode };
  }

  private isAfterLock(order: OrderWithDeposit): boolean {
    return this.depositCalculationService.isAfterRefundLockPoint(
      order.fulfillment_method,
      order.current_status
    );
  }

  private async initiateTrackedDepositRefund(
    order: OrderWithDeposit
  ): Promise<DepositRefundResult> {
    const claimed = await this.claimDepositRefund(order.id);
    if (!claimed) {
      return this.fail('Refund already in progress or completed', 'REFUND_IN_PROGRESS');
    }
    try {
      const payout = await this.startGiveChangeRefund(order);
      if (!payout.success) {
        await this.markRefundAttempted(order.id, 'failed', payout.message);
        return payout;
      }
      return payout;
    } catch (error: any) {
      await this.markRefundAttempted(order.id, 'failed', error.message);
      throw error;
    }
  }

  private async startGiveChangeRefund(
    order: OrderWithDeposit
  ): Promise<DepositRefundResult> {
    const account = await this.resolveClientAccount(order);
    const phone = order.recipient_phone || order.payer_phone;
    if (!account || !phone) {
      return this.fail(
        !account ? 'Client account not found' : 'Missing refund phone',
        !account ? 'ACCOUNT_NOT_FOUND' : 'MISSING_PHONE'
      );
    }
    const payout = await this.giveChangePayoutService.executeGiveChangePayout(
      {
        amount: order.deposit_amount,
        currency: order.currency,
        description: `Deposit refund for order ${order.order_number}`,
        customerPhone: phone,
        accountId: account.id,
        entityId: order.id,
        paymentEntity: 'order_deposit_refund',
      },
      { throwOnWithdrawalFailure: false }
    );
    if (!payout.success || !payout.data?.transactionId) {
      return this.fail(
        payout.data?.message || 'Refund initiation failed',
        'WITHDRAWAL_FAILED'
      );
    }
    return {
      success: true,
      transactionId: payout.data.transactionId,
      message: 'Deposit refund initiated',
    };
  }

  private async clawbackForfeitedDeposit(
    order: OrderWithDeposit
  ): Promise<{ success: boolean; message?: string }> {
    const account = await this.resolveClientAccount(order);
    const referenceId = order.deposit_mobile_payment_transaction_id;
    if (!account || !referenceId) {
      return {
        success: false,
        message: !account
          ? 'Client account not found'
          : 'Missing deposit transaction id',
      };
    }
    const result = await this.accountsService.registerWithdrawalIfNotExists({
      accountId: account.id,
      amount: order.deposit_amount,
      referenceId,
      memo: `Deposit forfeited for order ${order.order_number}`,
    });
    if (!result.success) {
      return { success: false, message: result.error || 'Wallet clawback failed' };
    }
    return { success: true };
  }

  private async resolveClientAccount(
    order: OrderWithDeposit
  ): Promise<{ id: string } | null> {
    const userId = order.client?.user_id;
    if (!userId) {
      return null;
    }
    return this.hasuraSystemService.getAccount(userId, order.currency);
  }

  private validateRefundEligibility(order: OrderWithDeposit): {
    eligible: boolean;
    reason?: string;
    code?: string;
  } {
    if (!order.deposit_amount || order.deposit_amount <= 0) {
      return { eligible: false, reason: 'No deposit amount on order', code: 'NO_DEPOSIT' };
    }
    if (order.deposit_status === 'refunded') {
      return { eligible: false, reason: 'Deposit already refunded', code: 'ALREADY_REFUNDED' };
    }
    if (order.deposit_status === 'forfeited') {
      return { eligible: false, reason: 'Deposit was forfeited', code: 'DEPOSIT_FORFEITED' };
    }
    if (order.deposit_status !== 'paid') {
      return { eligible: false, reason: 'Deposit not yet captured', code: 'DEPOSIT_NOT_CAPTURED' };
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

  private async claimDepositRefund(orderId: string): Promise<boolean> {
    const mutation = `
      mutation ClaimDepositRefund($orderId: uuid!) {
        update_orders(
          where: {
            id: { _eq: $orderId }
            deposit_status: { _eq: "paid" }
            deposit_refund_status: { _nin: ["pending", "refunded"] }
          }
          _set: { deposit_refund_status: "pending" }
        ) {
          affected_rows
        }
      }
    `;
    const result = await this.hasuraSystemService.executeMutation<{
      update_orders: { affected_rows: number } | null;
    }>(mutation, { orderId });
    return (result.update_orders?.affected_rows ?? 0) > 0;
  }

  private async markForfeited(
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

  private async markRefundAttempted(
    orderId: string,
    status: 'pending' | 'failed',
    notes?: string
  ): Promise<void> {
    const mutation = `
      mutation MarkDepositRefundAttempted($orderId: uuid!, $status: String!) {
        update_orders_by_pk(
          pk_columns: { id: $orderId }
          _set: { deposit_refund_status: $status }
        ) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, { orderId, status });
    if (notes) {
      this.logger.warn(
        `Deposit refund attempt ${status} for order ${orderId}: ${notes}`
      );
    }
  }

  private async getOrderWithDeposit(
    orderId: string
  ): Promise<OrderWithDeposit | null> {
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
          client { user_id }
          business_location {
            address { country }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, { orderId });
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

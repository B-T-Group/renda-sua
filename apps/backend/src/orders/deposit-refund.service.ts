import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { DepositCalculationService } from './deposit-calculation.service';
import { DepositLedgerService, depositLedgerKey } from './deposit-ledger.service';

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

/** Deposit lifecycle values of public.order_deposit_status_enum. */
export type DepositStatus =
  | 'none'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'forfeited'
  | 'refunded'
  | 'applied';

/**
 * Deposit states that are final for money: nothing may move the deposit again.
 * applied = consumed by settlement, forfeited = moved to HQ, refunded = released.
 */
export const RESOLVED_DEPOSIT_STATUSES: ReadonlySet<string> = new Set([
  'applied',
  'forfeited',
  'refunded',
]);

type DepositClaimTarget = 'forfeited' | 'refunded' | 'applied';

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
   *
   * Claim first (deposit_status paid → refunded, refund pending), then release.
   * Only one of refund / forfeit / settlement-apply can win the claim.
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

      if (this.isRefundInFlight(order)) {
        return this.resumeRefund(order);
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

      if (await this.isDepositConsumed(order, clientAccount.id)) {
        return this.refuseConsumedDeposit(order, 'refund');
      }

      const claimed = await this.claimDepositTransition(orderId, 'refunded', {
        deposit_status: 'refunded',
        deposit_refund_status: 'pending',
      });
      if (!claimed) {
        return this.lostClaimResult(orderId, 'refund');
      }

      try {
        await this.depositLedgerService.releaseDepositToAvailable({
          clientAccountId: clientAccount.id,
          amount: order.deposit_amount,
          orderNumber: order.order_number,
          depositTransactionId: order.deposit_mobile_payment_transaction_id,
        });
      } catch (error: any) {
        // Nothing moved (release is the only leg): hand the deposit back to
        // 'paid' so a retry, forfeit or settlement can still act on it.
        await this.revertRefundClaim(orderId);
        throw error;
      }

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
   *
   * Claim first (conditional deposit_status paid → forfeited), then move the
   * ledger with once-only keys. A claimed forfeit whose ledger did not finish
   * stays 'forfeited' and is resumed (idempotently) by calling this again.
   */
  async forfeitDeposit(
    orderId: string,
    reason: DepositForfeitReason,
    options?: { forfeitedByUserId?: string | null }
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

      if (order.deposit_status === 'forfeited') {
        return this.resumeForfeit(order);
      }

      if (order.deposit_forfeited_at) {
        return {
          success: false,
          message: 'Deposit already forfeited',
          errorCode: 'ALREADY_FORFEITED',
        };
      }

      if (order.deposit_status !== 'paid' || !(Number(order.deposit_amount) > 0)) {
        return {
          success: false,
          message: `No held deposit to forfeit (deposit_status=${order.deposit_status})`,
          errorCode: this.statusErrorCode(order.deposit_status),
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

      if (await this.isDepositConsumed(order, clientAccount.id)) {
        return this.refuseConsumedDeposit(order, 'forfeit');
      }

      const claimed = await this.claimDepositTransition(orderId, 'forfeited', {
        deposit_status: 'forfeited',
        deposit_forfeit_reason: reason,
        deposit_forfeited_at: new Date().toISOString(),
        deposit_forfeited_by_user_id: options?.forfeitedByUserId ?? null,
      });
      if (!claimed) {
        return this.lostClaimResult(orderId, 'forfeit');
      }

      return this.moveForfeitLedger(order, clientAccount.id, reason);
    } catch (error: any) {
      this.logger.error(`Failed to forfeit deposit for order ${orderId}:`, error);
      return {
        success: false,
        message: error.message || 'Deposit forfeit failed',
        errorCode: 'FORFEIT_ERROR',
      };
    }
  }

  /**
   * Settlement consumed (or is consuming) the held deposit: conditional
   * deposit_status paid → applied. Returns the deposit status after the attempt
   * ('applied' when this call or an earlier attempt applied it).
   */
  async claimDepositApplied(orderId: string): Promise<string | null> {
    const claimed = await this.claimDepositTransition(orderId, 'applied', {
      deposit_status: 'applied',
    });
    if (claimed) return 'applied';
    return this.readDepositStatus(orderId);
  }

  private async moveForfeitLedger(
    order: any,
    clientAccountId: string,
    reason: string
  ): Promise<DepositRefundResult> {
    try {
      await this.depositLedgerService.forfeitDepositToHq({
        clientAccountId,
        amount: order.deposit_amount,
        currency: order.currency,
        orderNumber: order.order_number,
        depositTransactionId: order.deposit_mobile_payment_transaction_id,
      });
    } catch (error: any) {
      // Check if the ledger is actually complete (all legs exist, despite the error).
      // A racing forfeit may have succeeded while this one was pending, and the
      // duplicate-key / unique-constraint error from the idempotency insert means
      // the leg is already posted. Re-read the legs to confirm completeness.
      const isComplete = await this.isForfeitLedgerComplete(
        clientAccountId,
        order.deposit_mobile_payment_transaction_id
      );
      if (isComplete) {
        this.logger.log(
          `Deposit forfeit legs already complete for order ${order.order_number} (concurrent forfeit won)`
        );
        return { success: true, message: 'Deposit forfeited to Rendasua' };
      }
      // Claimed but incomplete: stays 'forfeited' (no other flow may touch it).
      // Calling forfeitDeposit again resumes the keyed moves without double posting.
      this.logger.error(
        `deposit_forfeit_ledger_incomplete order=${order.order_number} orderId=${order.id}: ${error?.message}`
      );
      return {
        success: false,
        message: error?.message || 'Deposit forfeit ledger incomplete',
        errorCode: 'FORFEIT_LEDGER_INCOMPLETE',
      };
    }
    this.logger.log(
      `Deposit forfeited for order ${order.order_number}: ${reason}`
    );
    return { success: true, message: 'Deposit forfeited to Rendasua' };
  }

  /**
   * True only when the forfeit is really finished: the keyed client debit
   * (payment) and HQ credit (forfeit_hq) both exist, and either the keyed
   * release exists or nothing is still held under this deposit (the ledger may
   * legitimately skip the release when the deposit has no hold, see
   * DepositLedgerService.releaseDepositHoldForForfeit). Legs are read by their
   * unique idempotency keys, so a concurrent forfeit that posted a leg (and made
   * this call hit a duplicate key) is recognised, while a half-done ledger is not.
   */
  private async isForfeitLedgerComplete(
    clientAccountId: string,
    depositTransactionId: string
  ): Promise<boolean> {
    const key = (m: 'release' | 'payment' | 'forfeit_hq') =>
      depositLedgerKey(depositTransactionId, m);
    try {
      const legs = await this.hasuraSystemService.executeQuery<{
        account_transactions: Array<{ idempotency_key: string | null }>;
        holds: Array<{ transaction_type: string; amount?: number | string }>;
      }>(
        `
        query GetForfeitLegs($keys: [String!]!, $accountId: uuid!, $referenceId: uuid!) {
          account_transactions(where: { idempotency_key: { _in: $keys } }) {
            idempotency_key
          }
          holds: account_transactions(
            where: {
              account_id: { _eq: $accountId }
              reference_id: { _eq: $referenceId }
              transaction_type: { _in: [hold, release] }
            }
          ) {
            transaction_type
            amount
          }
        }
        `,
        {
          keys: [key('release'), key('payment'), key('forfeit_hq')],
          accountId: clientAccountId,
          referenceId: depositTransactionId,
        }
      );
      const found = new Set(
        (legs?.account_transactions ?? []).map((t) => t.idempotency_key)
      );
      if (!found.has(key('payment')) || !found.has(key('forfeit_hq'))) {
        return false;
      }
      if (found.has(key('release'))) return true;
      const net = (legs?.holds ?? []).reduce(
        (sum, row) =>
          sum +
          (row.transaction_type === 'hold' ? 1 : -1) * Number(row.amount || 0),
        0
      );
      return Number(net.toFixed(2)) <= 0;
    } catch (error: any) {
      this.logger.error(
        `Failed to check forfeit ledger completeness: ${error?.message}`
      );
      return false;
    }
  }

  /** Already forfeited: finish any missing keyed ledger move (no-op when complete). */
  private async resumeForfeit(order: any): Promise<DepositRefundResult> {
    if (!order.deposit_mobile_payment_transaction_id || !(Number(order.deposit_amount) > 0)) {
      return {
        success: false,
        message: 'Deposit already forfeited',
        errorCode: 'ALREADY_FORFEITED',
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
    const result = await this.moveForfeitLedger(
      order,
      clientAccount.id,
      order.deposit_forfeit_reason ?? 'resume'
    );
    return result.success
      ? { success: true, message: 'Deposit already forfeited', errorCode: 'ALREADY_FORFEITED' }
      : result;
  }

  private isRefundInFlight(order: any): boolean {
    return (
      order.deposit_status === 'refunded' &&
      order.deposit_refund_status === 'pending'
    );
  }

  /** Claimed refund whose release did not finish (crash between claim and release). */
  private async resumeRefund(order: any): Promise<DepositRefundResult> {
    const clientAccount = await this.hasuraSystemService.getAccount(
      order.client_user_id,
      order.currency
    );
    if (!clientAccount?.id || !order.deposit_mobile_payment_transaction_id) {
      return {
        success: false,
        message: 'Cannot resume deposit refund',
        errorCode: 'REFUND_IN_PROGRESS',
      };
    }
    try {
      await this.depositLedgerService.releaseDepositToAvailable({
        clientAccountId: clientAccount.id,
        amount: order.deposit_amount,
        orderNumber: order.order_number,
        depositTransactionId: order.deposit_mobile_payment_transaction_id,
      });
      await this.markDepositRefunded(order.id);
    } catch (error: any) {
      // Stay refunded/pending so the next call resumes again (keyed release).
      this.logger.error(
        `deposit_refund_resume_failed order=${order.order_number}: ${error?.message}`
      );
      return {
        success: false,
        message: error?.message || 'Deposit refund resume failed',
        errorCode: 'REFUND_IN_PROGRESS',
      };
    }
    return { success: true, message: 'Deposit refund completed' };
  }

  /**
   * Defense in depth for rows settled before 'applied' existed: the item
   * settlement already released the deposit and debited the client for it.
   */
  private async isDepositConsumed(
    order: any,
    clientAccountId: string
  ): Promise<boolean> {
    const holds = order.order_holds ?? [];
    if (holds.some((hold: any) => hold?.item_settlement_completed_at)) {
      return true;
    }
    const [settlementPayment, depositPayment] = await Promise.all([
      this.hasClientPayment(clientAccountId, order.id),
      this.hasClientPayment(
        clientAccountId,
        order.deposit_mobile_payment_transaction_id
      ),
    ]);
    return settlementPayment || depositPayment;
  }

  private async hasClientPayment(
    accountId: string,
    referenceId: string | null | undefined
  ): Promise<boolean> {
    if (!referenceId) return false;
    const result = await this.hasuraSystemService.executeQuery(
      `
      query DepositConsumedPayment($accountId: uuid!, $referenceId: uuid!) {
        account_transactions(
          where: {
            account_id: { _eq: $accountId }
            transaction_type: { _eq: payment }
            reference_id: { _eq: $referenceId }
          }
          limit: 1
        ) { id }
      }
      `,
      { accountId, referenceId }
    );
    return (result?.account_transactions?.length ?? 0) > 0;
  }

  private async refuseConsumedDeposit(
    order: any,
    action: 'refund' | 'forfeit'
  ): Promise<DepositRefundResult> {
    this.logger.warn(
      `deposit_${action}_refused_consumed order=${order.order_number}: settlement already applied the deposit`
    );
    try {
      await this.claimDepositTransition(order.id, 'applied', {
        deposit_status: 'applied',
      });
    } catch (error: any) {
      this.logger.warn(
        `Could not relabel consumed deposit as applied for ${order.order_number}: ${error?.message}`
      );
    }
    return {
      success: false,
      message: 'Deposit was already applied to the order payment',
      errorCode: 'DEPOSIT_APPLIED',
    };
  }

  private async lostClaimResult(
    orderId: string,
    action: 'refund' | 'forfeit'
  ): Promise<DepositRefundResult> {
    const status = await this.readDepositStatus(orderId);
    this.logger.warn(
      `deposit_${action}_claim_lost orderId=${orderId} deposit_status=${status}`
    );
    return {
      success: false,
      message: `Deposit is no longer held (deposit_status=${status})`,
      errorCode: this.statusErrorCode(status),
    };
  }

  private statusErrorCode(status: string | null | undefined): string {
    switch (status) {
      case 'refunded':
        return 'ALREADY_REFUNDED';
      case 'forfeited':
        return 'DEPOSIT_FORFEITED';
      case 'applied':
        return 'DEPOSIT_APPLIED';
      default:
        return 'DEPOSIT_NOT_CAPTURED';
    }
  }

  /** Conditional write: only a deposit that is still 'paid' can move. */
  private async claimDepositTransition(
    orderId: string,
    target: DepositClaimTarget,
    set: Record<string, unknown>
  ): Promise<boolean> {
    const result = await this.hasuraSystemService.executeMutation<{
      update_orders: { affected_rows: number } | null;
    }>(
      `
      mutation ClaimDepositTransition($orderId: uuid!, $set: orders_set_input!) {
        update_orders(
          where: { id: { _eq: $orderId }, deposit_status: { _eq: paid } }
          _set: $set
        ) { affected_rows }
      }
      `,
      { orderId, set }
    );
    const won = (result?.update_orders?.affected_rows ?? 0) === 1;
    if (won) {
      this.logger.log(`deposit_claim order=${orderId} paid->${target}`);
    }
    return won;
  }

  private async revertRefundClaim(orderId: string): Promise<void> {
    try {
      await this.hasuraSystemService.executeMutation(
        `
        mutation RevertDepositRefundClaim($orderId: uuid!) {
          update_orders(
            where: {
              id: { _eq: $orderId }
              deposit_status: { _eq: refunded }
              deposit_refund_status: { _eq: pending }
            }
            _set: { deposit_status: paid }
          ) { affected_rows }
        }
        `,
        { orderId }
      );
    } catch (error: any) {
      this.logger.error(
        `deposit_refund_claim_revert_failed orderId=${orderId}: ${error?.message}`
      );
    }
  }

  private async readDepositStatus(orderId: string): Promise<string | null> {
    const result = await this.hasuraSystemService.executeQuery(
      `
      query ReadDepositStatus($orderId: uuid!) {
        orders_by_pk(id: $orderId) { deposit_status }
      }
      `,
      { orderId }
    );
    return result?.orders_by_pk?.deposit_status ?? null;
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

    if (order.deposit_status === 'applied') {
      return {
        eligible: false,
        reason: 'Deposit was already applied to the order payment',
        code: 'DEPOSIT_APPLIED',
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
        update_orders(
          where: { id: { _eq: $orderId }, deposit_status: { _eq: refunded } }
          _set: {
            deposit_refund_status: "refunded"
            deposit_refunded_at: $now
          }
        ) {
          affected_rows
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
          order_holds {
            item_settlement_completed_at
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

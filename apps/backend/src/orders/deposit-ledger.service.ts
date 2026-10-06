import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

/**
 * Reservation deposit ledger moves.
 *
 * account_transactions.reference_id is UUID — use the deposit MoMo txn id for
 * hold/release/forfeit (same pattern as GIVE_CHANGE using mobile_tx.id).
 * Settlement item payment still uses orderId, so it does not collide.
 *
 * Every move also carries a once-only idempotency key derived from the deposit
 * txn id (see depositLedgerKey). The keys are shared across purposes on purpose:
 * a deposit has exactly one hold, one release and at most one client payment, so
 * a refund racing a forfeit (or settlement) cannot both release, and a forfeit
 * racing a cash-exception apply cannot both debit, even if both pass the
 * reference check at the same moment.
 */
export function depositLedgerKey(
  depositTransactionId: string,
  move: 'hold' | 'release' | 'payment' | 'forfeit_hq'
): string {
  return `deposit:${depositTransactionId}:${move}`;
}

@Injectable()
export class DepositLedgerService {
  private readonly logger = new Logger(DepositLedgerService.name);

  constructor(
    private readonly accountsService: AccountsService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  /**
   * After MoMo deposit SUCCESS: credit available, then hold so client cannot withdraw.
   * Fail-closed: if credit or hold fails, throw (caller must not mark deposit paid).
   */
  async creditAndHoldDeposit(params: {
    clientAccountId: string;
    amount: number;
    orderNumber: string;
    /** mobile_payment_transactions.id for the order_deposit collect */
    depositTransactionId: string;
  }): Promise<void> {
    const credit = await this.accountsService.registerDepositIfNotExists({
      accountId: params.clientAccountId,
      amount: params.amount,
      referenceId: params.depositTransactionId,
      memo: `Deposit captured for order ${params.orderNumber}`,
      skipCashAdvanceRepayment: true,
    });
    if (!credit?.success) {
      throw new Error(
        `Deposit wallet credit failed for ${params.orderNumber}: ${credit?.error ?? 'unknown'}`
      );
    }

    await this.holdDepositWithRetry(params);

    this.logger.log(
      `Deposit ${params.amount} credited and held for order ${params.orderNumber}`
    );
  }

  /**
   * Hold may race the deposit balance update (Hasura read-after-write). Retry once.
   */
  private async holdDepositWithRetry(params: {
    clientAccountId: string;
    amount: number;
    orderNumber: string;
    depositTransactionId: string;
  }): Promise<void> {
    const attempt = () =>
      this.accountsService.registerHoldIfNotExists({
        accountId: params.clientAccountId,
        amount: params.amount,
        referenceId: params.depositTransactionId,
        memo: `Deposit hold for order ${params.orderNumber}`,
        idempotencyKey: depositLedgerKey(params.depositTransactionId, 'hold'),
      });

    let hold = await attempt();
    if (!hold?.success) {
      await new Promise((r) => setTimeout(r, 150));
      hold = await attempt();
    }
    if (!hold?.success) {
      throw new Error(
        `Deposit wallet hold failed for ${params.orderNumber}: ${hold?.error ?? 'unknown'}`
      );
    }
  }

  /**
   * Ensure deposit is held (for legacy deposits that only hit available).
   * Fail closed if funds are gone.
   */
  async ensureDepositHeld(params: {
    clientAccountId: string;
    amount: number;
    orderNumber: string;
    depositTransactionId: string;
  }): Promise<void> {
    const alreadyHeld = await this.accountsService.hasTransactionForReference({
      accountId: params.clientAccountId,
      transactionType: 'hold',
      referenceId: params.depositTransactionId,
    });
    if (alreadyHeld) return;

    const hold = await this.accountsService.registerHoldIfNotExists({
      accountId: params.clientAccountId,
      amount: params.amount,
      referenceId: params.depositTransactionId,
      memo: `Deposit hold (legacy catch-up) for order ${params.orderNumber}`,
      idempotencyKey: depositLedgerKey(params.depositTransactionId, 'hold'),
    });
    if (!hold?.success) {
      throw new Error(
        `Cannot hold deposit for order ${params.orderNumber}: ${hold?.error ?? 'insufficient available balance'}`
      );
    }
  }

  /**
   * Release withheld deposit back to client available balance.
   */
  async releaseDepositToAvailable(params: {
    clientAccountId: string;
    amount: number;
    orderNumber: string;
    depositTransactionId: string;
    memo?: string;
  }): Promise<void> {
    await this.ensureDepositHeld(params);

    const release = await this.accountsService.registerReleaseIfNotExists({
      accountId: params.clientAccountId,
      amount: params.amount,
      referenceId: params.depositTransactionId,
      memo:
        params.memo ??
        `Deposit refund released for order ${params.orderNumber}`,
      idempotencyKey: depositLedgerKey(params.depositTransactionId, 'release'),
    });
    if (!release?.success) {
      throw new Error(
        `Deposit release failed for order ${params.orderNumber}: ${release?.error ?? 'unknown'}`
      );
    }
  }

  /**
   * Cash exception / off-ledger remainder: release hold then debit the deposit.
   * Remainder stays off-wallet. Idempotent via deposit txn reference.
   */
  async applyHeldDepositAsPayment(params: {
    clientAccountId: string;
    amount: number;
    orderNumber: string;
    depositTransactionId: string;
  }): Promise<void> {
    if (await this.hasAppliedDepositPayment(params)) return;

    await this.releaseDepositToAvailable({
      ...params,
      memo: `Deposit released for settlement of order ${params.orderNumber}`,
    });

    const debit = await this.accountsService.registerPaymentIfNotExists({
      accountId: params.clientAccountId,
      amount: params.amount,
      referenceId: params.depositTransactionId,
      memo: `Deposit applied for order ${params.orderNumber}`,
      idempotencyKey: depositLedgerKey(params.depositTransactionId, 'payment'),
    });
    if (!debit?.success) {
      throw new Error(
        `Deposit apply payment failed for ${params.orderNumber}: ${debit?.error ?? 'unknown'}`
      );
    }
  }

  private async hasAppliedDepositPayment(params: {
    clientAccountId: string;
    depositTransactionId: string;
  }): Promise<boolean> {
    return this.accountsService.hasTransactionForReference({
      accountId: params.clientAccountId,
      transactionType: 'payment',
      referenceId: params.depositTransactionId,
    });
  }

  /**
   * Forfeit: release hold → debit client available → credit Rendasua HQ available.
   * Callers must have claimed the deposit (deposit_status paid → forfeited) first;
   * this method is idempotent so a claimed-but-incomplete forfeit can be resumed.
   */
  async forfeitDepositToHq(params: {
    clientAccountId: string;
    amount: number;
    currency: string;
    orderNumber: string;
    depositTransactionId: string;
  }): Promise<void> {
    await this.ensureDepositHeld(params);

    const release = await this.accountsService.registerReleaseIfNotExists({
      accountId: params.clientAccountId,
      amount: params.amount,
      referenceId: params.depositTransactionId,
      memo: `Deposit forfeit release for order ${params.orderNumber}`,
      idempotencyKey: depositLedgerKey(params.depositTransactionId, 'release'),
    });
    if (!release?.success) {
      throw new Error(
        `Deposit forfeit release failed for ${params.orderNumber}: ${release?.error ?? 'unknown'}`
      );
    }

    // Debit client after release (idempotent — safe on forfeit retry).
    // Reference = deposit txn id (settlement uses orderId — no collision).
    const debit = await this.accountsService.registerPaymentIfNotExists({
      accountId: params.clientAccountId,
      amount: params.amount,
      referenceId: params.depositTransactionId,
      memo: `Deposit forfeited for order ${params.orderNumber}`,
      idempotencyKey: depositLedgerKey(params.depositTransactionId, 'payment'),
    });
    if (!debit?.success) {
      throw new Error(
        `Deposit forfeit debit failed for ${params.orderNumber}: ${debit?.error ?? 'unknown'}`
      );
    }

    const hqUser = await this.hasuraSystemService.getRendasuaHQUser();
    if (!hqUser?.id) {
      throw new Error('Rendasua HQ user not found for deposit forfeit');
    }
    const hqAccount = await this.hasuraSystemService.getAccount(
      hqUser.id,
      params.currency
    );
    if (!hqAccount?.id) {
      throw new Error(
        `Rendasua HQ account not found for currency ${params.currency}`
      );
    }

    const credit = await this.accountsService.registerDepositIfNotExists({
      accountId: hqAccount.id,
      amount: params.amount,
      referenceId: params.depositTransactionId,
      memo: `Deposit forfeited from order ${params.orderNumber}`,
      idempotencyKey: depositLedgerKey(params.depositTransactionId, 'forfeit_hq'),
      // HQ revenue, never a cash-advance repayment.
      skipCashAdvanceRepayment: true,
    });
    if (!credit?.success) {
      throw new Error(
        `Deposit forfeit HQ credit failed for ${params.orderNumber}: ${credit?.error ?? 'unknown'}`
      );
    }

    this.logger.log(
      `Deposit ${params.amount} ${params.currency} forfeited to HQ for order ${params.orderNumber}`
    );
  }
}

import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  buildFreemopayReplayDto,
  buildMypvitReplayDto,
} from './callback-replay.util';
import { MobilePaymentCallbackProcessor } from './mobile-payment-callback.processor';
import type { MobilePaymentTransaction } from './mobile-payments-database.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
import type {
  MobilePaymentIntegrationProvider,
  MobileTransactionStatus,
} from './mobile-payments.service';
import { MobilePaymentsService } from './mobile-payments.service';

export type PendingWithdrawalOutcome =
  | 'cancelled'
  | 'paid'
  | 'failed'
  | 'still_pending';

export interface PendingWithdrawalResolveResult {
  success: boolean;
  outcome: PendingWithdrawalOutcome;
  message: string;
  /** Provider transaction reference when known (null if never accepted by MoMo). */
  transaction_id: string | null;
  /** Live provider status when checked; otherwise the resulting local transaction status. */
  status: MobileTransactionStatus;
  data?: {
    providerStatus?: MobileTransactionStatus;
    provider?: MobilePaymentIntegrationProvider;
  };
}

@Injectable()
export class PendingWithdrawalResolveService {
  private readonly logger = new Logger(PendingWithdrawalResolveService.name);

  constructor(
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly callbackProcessor: MobilePaymentCallbackProcessor,
    private readonly accountsService: AccountsService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  async resolveForUser(
    id: string,
    userId: string,
    req?: Request
  ): Promise<PendingWithdrawalResolveResult> {
    const tx = await this.loadPendingGiveChange(id);
    await this.assertAccountOwnedByUser(tx.account_id, userId);
    const result = await this.resolveTransaction(tx, req, {
      allowImmediateCancel: true,
    });
    // Do not treat "still waiting on MoMo" as a successful resolve for users.
    if (result.outcome === 'still_pending') {
      throw new HttpException(
        {
          success: false,
          message: result.message,
          error: 'STILL_PENDING',
          data: {
            outcome: result.outcome,
            transaction_id: result.transaction_id,
            status: result.status,
          },
        },
        HttpStatus.CONFLICT
      );
    }
    return result;
  }

  async resolveAsSystem(
    id: string,
    options?: { allowImmediateCancel?: boolean; minAgeHours?: number }
  ): Promise<PendingWithdrawalResolveResult> {
    const tx = await this.loadPendingGiveChange(id);
    return this.resolveTransaction(tx, undefined, {
      allowImmediateCancel: options?.allowImmediateCancel ?? false,
      minAgeHours: options?.minAgeHours ?? 24,
    });
  }

  private async loadPendingGiveChange(
    id: string
  ): Promise<MobilePaymentTransaction> {
    const tx = await this.databaseService.getTransactionById(id);
    if (!tx) {
      throw new NotFoundException('Withdrawal not found');
    }
    if (tx.transaction_type !== 'GIVE_CHANGE') {
      throw new HttpException(
        {
          success: false,
          message: 'Not a withdrawal transaction',
          error: 'NOT_GIVE_CHANGE',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    if (tx.status !== 'pending') {
      throw new HttpException(
        {
          success: false,
          message: `Withdrawal is already ${tx.status}`,
          error: 'NOT_PENDING',
        },
        HttpStatus.CONFLICT
      );
    }
    if (!tx.account_id) {
      throw new HttpException(
        {
          success: false,
          message: 'Withdrawal has no linked account',
          error: 'MISSING_ACCOUNT',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return tx;
  }

  private async assertAccountOwnedByUser(
    accountId: string | undefined,
    userId: string
  ): Promise<void> {
    if (!accountId) {
      throw new ForbiddenException('Withdrawal account not found');
    }
    const result = await this.hasuraSystemService.executeQuery(
      `
      query AccountOwner($accountId: uuid!) {
        accounts_by_pk(id: $accountId) {
          id
          user_id
        }
      }
    `,
      { accountId }
    );
    const account = result.accounts_by_pk as
      | { id: string; user_id: string }
      | null;
    if (!account || account.user_id !== userId) {
      throw new ForbiddenException('You do not own this withdrawal');
    }
  }

  private async resolveTransaction(
    tx: MobilePaymentTransaction,
    req: Request | undefined,
    options: { allowImmediateCancel: boolean; minAgeHours?: number }
  ): Promise<PendingWithdrawalResolveResult> {
    const providerTxId = tx.transaction_id?.trim();
    if (!providerTxId) {
      return this.cancelWithoutProvider(tx, options);
    }
    return this.finalizeFromProvider(tx, providerTxId, req);
  }

  private async cancelWithoutProvider(
    tx: MobilePaymentTransaction,
    options: { allowImmediateCancel: boolean; minAgeHours?: number }
  ): Promise<PendingWithdrawalResolveResult> {
    if (!options.allowImmediateCancel) {
      const minAgeMs = (options.minAgeHours ?? 24) * 60 * 60 * 1000;
      const ageMs = Date.now() - new Date(tx.created_at).getTime();
      if (ageMs < minAgeMs) {
        return {
          success: true,
          outcome: 'still_pending',
          message:
            'Withdrawal has no provider reference yet; waiting for grace period',
          transaction_id: null,
          status: this.statusFromLocalTx(tx, 'pending', {
            message: 'Waiting for provider reference',
          }),
        };
      }
    }

    await this.databaseService.updateTransaction(tx.id, {
      status: 'cancelled',
      error_message: 'Cancelled before provider accepted withdrawal',
      error_code: 'USER_CANCELLED',
    });

    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId: tx.account_id as string,
      amount: tx.amount,
      referenceId: tx.id,
      memo: `GIVE_CHANGE release - ${tx.reference}`,
    });
    if (!released.success) {
      throw new HttpException(
        {
          success: false,
          message: released.error || 'Failed to release withdrawal hold',
          error: 'RELEASE_FAILED',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const status = this.statusFromLocalTx(tx, 'cancelled', {
      message: 'Cancelled before provider accepted withdrawal',
    });
    return {
      success: true,
      outcome: 'cancelled',
      message:
        'Pending withdrawal cancelled. Funds returned to available balance.',
      transaction_id: tx.transaction_id?.trim() || null,
      status,
      data: { providerStatus: status },
    };
  }

  private async finalizeFromProvider(
    tx: MobilePaymentTransaction,
    providerTxId: string,
    req?: Request
  ): Promise<PendingWithdrawalResolveResult> {
    let provider: MobilePaymentIntegrationProvider;
    try {
      provider = this.mobilePaymentsService.resolveAdminIntegrationProvider(
        tx.customer_phone,
        tx.provider
      );
    } catch (error: any) {
      if (error?.message === 'UNSUPPORTED_INTEGRATION_PROVIDER') {
        throw new HttpException(
          {
            success: false,
            message: 'Cannot determine payment provider for this withdrawal',
            error: 'UNSUPPORTED_PROVIDER',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      throw error;
    }

    let live: MobileTransactionStatus;
    try {
      live = await this.mobilePaymentsService.checkTransactionStatus(
        providerTxId,
        provider,
        tx.customer_phone ?? undefined
      );
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: 'Could not check Mobile Money status. Try again later.',
          error: error?.message || String(error),
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    const normalizedStatus = this.normalizeLiveStatus(live.status);
    live = { ...live, status: normalizedStatus };
    const transactionId = live.transactionId?.trim() || providerTxId;

    if (live.status === 'pending' || live.status === 'ambiguous') {
      return {
        success: true,
        outcome: 'still_pending',
        message:
          live.status === 'ambiguous'
            ? 'Mobile Money status is uncertain. Try again later.'
            : 'Withdrawal is still pending with Mobile Money.',
        transaction_id: transactionId,
        status: live,
        data: { providerStatus: live, provider },
      };
    }

    await this.replayCallback(tx, live, provider, req);

    const outcome: PendingWithdrawalOutcome =
      live.status === 'success' ? 'paid' : 'failed';
    return {
      success: true,
      outcome,
      message:
        outcome === 'paid'
          ? 'Withdrawal completed. Funds have been sent.'
          : 'Withdrawal failed. Funds returned to available balance.',
      transaction_id: transactionId,
      status: live,
      data: { providerStatus: live, provider },
    };
  }

  private statusFromLocalTx(
    tx: MobilePaymentTransaction,
    status: MobileTransactionStatus['status'],
    extras?: { message?: string }
  ): MobileTransactionStatus {
    return {
      transactionId: tx.transaction_id?.trim() || tx.id,
      status,
      amount: tx.amount,
      currency: tx.currency,
      reference: tx.reference,
      message: extras?.message,
      provider: tx.provider,
    };
  }

  private normalizeLiveStatus(
    status: MobileTransactionStatus['status'] | string
  ): MobileTransactionStatus['status'] {
    const value = String(status || '').toLowerCase();
    if (
      value === 'pending' ||
      value === 'created' ||
      value === 'processing' ||
      value === 'ambiguous'
    ) {
      return value === 'ambiguous' ? 'ambiguous' : 'pending';
    }
    if (value === 'success' || value === 'successful' || value === 'paid') {
      return 'success';
    }
    if (value === 'cancelled' || value === 'canceled') {
      return 'cancelled';
    }
    return 'failed';
  }

  private async replayCallback(
    tx: MobilePaymentTransaction,
    live: MobileTransactionStatus,
    provider: MobilePaymentIntegrationProvider,
    req?: Request
  ): Promise<void> {
    if (provider === 'mypvit') {
      const dto = buildMypvitReplayDto(
        tx,
        live,
        this.mobilePaymentsService.nationalCustomerIdForMypvit(tx.customer_phone)
      );
      await this.callbackProcessor.processMypvitCallback(dto, req);
      return;
    }

    if (provider === 'freemopay') {
      const dto = buildFreemopayReplayDto(tx, live);
      await this.callbackProcessor.processFreemopayCallback(dto, req);
      return;
    }

    // MTN / Orange: apply ledger directly without provider-specific callback DTO.
    if (live.status === 'success') {
      await this.finalizeSuccessDirect(tx, live);
      return;
    }
    await this.finalizeFailureDirect(tx, live);
  }

  private async finalizeSuccessDirect(
    tx: MobilePaymentTransaction,
    live: MobileTransactionStatus
  ): Promise<void> {
    const providerTransactionId = live.transactionId || tx.transaction_id;
    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId: tx.account_id as string,
      amount: tx.amount,
      referenceId: tx.id,
      memo: `GIVE_CHANGE release - ${tx.reference}`,
    });
    if (!released.success) {
      this.logger.error(
        `Release failed for GIVE_CHANGE ${tx.id}: ${released.error}`
      );
      await this.databaseService.updateTransaction(tx.id, {
        status: 'success',
        transaction_id: providerTransactionId,
        error_message:
          'Provider payout succeeded but wallet debit failed; manual reconciliation required',
        error_code: 'WITHDRAWAL_FAILED',
      });
      return;
    }

    const withdrawal = await this.accountsService.registerWithdrawalIfNotExists({
      accountId: tx.account_id as string,
      amount: tx.amount,
      referenceId: tx.id,
      memo: `Mobile payment give change - ${tx.reference}`,
    });
    if (!withdrawal.success) {
      this.logger.error(
        `Withdrawal debit failed for GIVE_CHANGE ${tx.id}: ${withdrawal.error}`
      );
      await this.databaseService.updateTransaction(tx.id, {
        status: 'success',
        transaction_id: providerTransactionId,
        error_message:
          'Provider payout succeeded but wallet debit failed; manual reconciliation required',
        error_code: 'WITHDRAWAL_FAILED',
      });
      return;
    }

    await this.databaseService.updateTransaction(tx.id, {
      status: 'success',
      transaction_id: providerTransactionId,
    });
  }

  private async finalizeFailureDirect(
    tx: MobilePaymentTransaction,
    live: MobileTransactionStatus
  ): Promise<void> {
    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId: tx.account_id as string,
      amount: tx.amount,
      referenceId: tx.id,
      memo: `GIVE_CHANGE release - ${tx.reference}`,
    });
    if (!released.success) {
      this.logger.error(
        `Release failed for GIVE_CHANGE ${tx.id}: ${released.error}`
      );
    }
    await this.databaseService.updateTransaction(tx.id, {
      status: 'failed',
      transaction_id: live.transactionId || tx.transaction_id,
      error_message: live.message || 'Withdrawal failed',
      error_code: 'PROVIDER_FAILED',
    });
  }
}

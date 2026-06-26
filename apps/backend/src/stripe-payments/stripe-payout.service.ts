import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import type { TransactionResult } from '../accounts/accounts.service';
import { StripeConnectService } from './stripe-connect.service';
import { StripePaymentsDatabaseService } from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

export interface StripePayoutParams {
  amount: number;
  currency: string;
  accountId: string;
  userId: string;
  description: string;
  withdrawalMemoPrefix?: string;
}

export interface StripePayoutResult {
  success: boolean;
  data?: {
    transactionId: string;
    transferId?: string;
    message?: string;
  };
}

interface TransferAttemptResult {
  transferId?: string;
  error?: string;
}

@Injectable()
export class StripePayoutService {
  private readonly logger = new Logger(StripePayoutService.name);

  constructor(
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly accountsService: AccountsService,
    private readonly stripeService: StripeService,
    private readonly connectService: StripeConnectService,
  ) {}

  private generateReference(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).slice(2, 6);
    return `SP${timestamp}${random}`;
  }

  /** Debit the internal wallet before creating the external Stripe Transfer. */
  async executePayout(
    params: StripePayoutParams,
    options: { throwOnFailure: boolean },
  ): Promise<StripePayoutResult> {
    const precheck = await this.runPrechecks(params);
    if (precheck) return this.handleFailure(precheck, options);

    const connect = await this.connectService.getByUserId(params.userId);
    if (!connect) {
      return this.handleFailure(
        {
          status: HttpStatus.BAD_REQUEST,
          body: {
            success: false,
            message: 'Stripe Connect account not found',
            error: 'NO_CONNECT_ACCOUNT',
          },
        },
        options,
      );
    }

    const reference = this.generateReference();
    const tx = await this.databaseService.createTransaction({
      reference,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      account_id: params.accountId,
      transaction_type: 'GIVE_CHANGE',
    });

    return this.transferAndDebit(
      tx.id,
      reference,
      params,
      connect.stripe_account_id,
      options,
    );
  }

  private async runPrechecks(
    params: StripePayoutParams,
  ): Promise<{ status: HttpStatus; body: Record<string, unknown> } | null> {
    const balance = await this.accountsService.getAccountBalance(
      params.accountId,
    );
    if (!balance) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: { success: false, error: 'ACCOUNT_NOT_FOUND' },
      };
    }
    if (balance.availableBalance < params.amount) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          message: 'Insufficient funds',
          error: 'INSUFFICIENT_FUNDS',
        },
      };
    }
    const ready = await this.connectService.isPayoutReady(params.userId);
    if (!ready) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          message: 'Stripe Connect account is not payout-ready',
          error: 'CONNECT_NOT_READY',
        },
      };
    }
    return null;
  }

  private async transferAndDebit(
    txId: string,
    reference: string,
    params: StripePayoutParams,
    destinationAccountId: string,
    options: { throwOnFailure: boolean },
  ): Promise<StripePayoutResult> {
    const withdrawal = await this.debitWallet(params, reference, txId);
    if (!withdrawal.success) {
      return this.failDebit(txId, withdrawal.error, options);
    }
    const transfer = await this.createTransfer(
      params,
      destinationAccountId,
      reference,
    );
    if (!transfer.transferId) {
      await this.reverseDebit(params, reference, txId);
      return this.failTransfer(txId, transfer.error, options);
    }
    await this.markTransferSuccess(txId, transfer.transferId);
    return {
      success: true,
      data: { transactionId: txId, transferId: transfer.transferId },
    };
  }

  private async debitWallet(
    params: StripePayoutParams,
    reference: string,
    txId: string,
  ): Promise<TransactionResult> {
    const memoPrefix = params.withdrawalMemoPrefix || 'Stripe payout';
    return this.accountsService.registerTransaction({
      accountId: params.accountId,
      amount: params.amount,
      transactionType: 'withdrawal',
      memo: `${memoPrefix} - ${reference}`,
      referenceId: txId,
    });
  }

  private async createTransfer(
    params: StripePayoutParams,
    destinationAccountId: string,
    reference: string,
  ): Promise<TransferAttemptResult> {
    try {
      const transfer = await this.stripeService.createTransfer({
        amount: params.amount,
        currency: params.currency,
        destinationAccountId,
        reference,
        description: params.description,
      });
      return { transferId: transfer.id };
    } catch (error: any) {
      return { error: String(error?.message || error) };
    }
  }

  private async reverseDebit(
    params: StripePayoutParams,
    reference: string,
    txId: string,
  ): Promise<void> {
    const reversal = await this.accountsService.registerTransaction({
      accountId: params.accountId,
      amount: params.amount,
      transactionType: 'deposit',
      memo: `Stripe payout reversal - ${reference}`,
      referenceId: txId,
    });
    if (!reversal.success) {
      this.logger.error(
        `Failed to reverse Stripe payout debit ${txId}: ${reversal.error}`,
      );
    }
  }

  private async markTransferSuccess(
    txId: string,
    transferId: string,
  ): Promise<void> {
    try {
      await this.databaseService.updateTransaction(txId, {
        status: 'success',
        stripe_payment_intent_id: transferId,
      });
    } catch (error: any) {
      this.logger.error(
        `Stripe payout ${txId} succeeded but status update failed: ${String(
          error?.message || error,
        )}`,
      );
    }
  }

  private async failDebit(
    txId: string,
    error: string | undefined,
    options: { throwOnFailure: boolean },
  ): Promise<StripePayoutResult> {
    await this.markFailed(txId, 'WITHDRAWAL_FAILED', error);
    return this.handleFailure(
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: { success: false, error: 'WITHDRAWAL_FAILED' },
      },
      options,
    );
  }

  private async failTransfer(
    txId: string,
    error: string | undefined,
    options: { throwOnFailure: boolean },
  ): Promise<StripePayoutResult> {
    await this.markFailed(txId, 'TRANSFER_FAILED', error);
    return this.handleFailure(
      {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          success: false,
          message: 'Failed to process Stripe payout',
          error: 'TRANSFER_FAILED',
        },
      },
      options,
    );
  }

  private async markFailed(
    txId: string,
    errorCode: string,
    error: string | undefined,
  ): Promise<void> {
    await this.databaseService.updateTransaction(txId, {
      status: 'failed',
      error_message: error || errorCode,
      error_code: errorCode,
    });
  }

  private handleFailure(
    err: { status: HttpStatus; body: Record<string, unknown> },
    options: { throwOnFailure: boolean },
  ): StripePayoutResult {
    if (options.throwOnFailure) {
      throw new HttpException(err.body, err.status);
    }
    this.logger.warn(`Stripe payout failed: ${JSON.stringify(err.body)}`);
    return { success: false };
  }
}

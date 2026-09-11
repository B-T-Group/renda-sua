import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import {
  MobilePaymentsDatabaseService,
  type CreateTransactionData,
} from './mobile-payments-database.service';
import {
  MobilePaymentResponse,
  MobilePaymentsService,
} from './mobile-payments.service';

export type GiveChangeProvider =
  | 'mypvit'
  | 'airtel'
  | 'moov'
  | 'mtn'
  | 'freemopay';

export interface GiveChangePayoutParams {
  amount: number;
  currency: string;
  description: string;
  customerPhone: string;
  accountId: string;
  provider?: GiveChangeProvider;
  paymentMethod?: string;
  callbackUrl?: string;
  mtnUserId?: string;
  withdrawalMemoPrefix?: string;
  /** Links this payout back to another transaction (e.g. verification PAYMENT id). */
  entityId?: string;
  paymentEntity?: CreateTransactionData['payment_entity'];
}

export interface GiveChangePayoutResult {
  success: boolean;
  data?: {
    transactionId: string;
    providerTransactionId?: string;
    paymentUrl?: string;
    message?: string;
    provider?: string;
  };
}

type HttpErr = { status: HttpStatus; body: Record<string, unknown> };

@Injectable()
export class GiveChangePayoutService {
  private readonly logger = new Logger(GiveChangePayoutService.name);

  constructor(
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly accountsService: AccountsService
  ) {}

  buildDefaultCallbackUrl(): string {
    const base = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${base}/mobile-payments/callback/pvit`;
  }

  generateReference(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4);
    return `P${timestamp}${random}`;
  }

  validateCurrencyForProvider(
    provider: GiveChangeProvider | undefined,
    currency: string
  ): HttpErr | null {
    if (
      (provider === 'airtel' || provider === 'moov') &&
      currency !== 'XAF'
    ) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          message:
            'Airtel Money and MOOV Money are only supported for XAF currency',
          error: 'UNSUPPORTED_CURRENCY',
          data: { provider, currency, supportedCurrency: 'XAF' },
        },
      };
    }
    return null;
  }

  async validateAccountForGiveChange(
    accountId: string,
    amount: number
  ): Promise<HttpErr | null> {
    const balance = await this.accountsService.getAccountBalance(accountId);
    if (!balance) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          message: 'Account not found',
          error: 'ACCOUNT_NOT_FOUND',
        },
      };
    }
    if (Number(balance.availableBalance) < 0) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          message:
            'Account balance is negative. Please top up your account before initiating payments.',
          error: 'NEGATIVE_BALANCE',
          data: {
            currentBalance: balance.availableBalance,
            currency: balance.currency,
          },
        },
      };
    }
    if (balance.availableBalance < amount) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          success: false,
          message: 'Insufficient funds',
          error: 'INSUFFICIENT_FUNDS',
          data: {
            required: amount,
            available: balance.availableBalance,
            currency: balance.currency,
          },
        },
      };
    }
    return null;
  }

  async executeGiveChangePayout(
    params: GiveChangePayoutParams,
    options: { throwOnWithdrawalFailure: boolean; initiatorUserId?: string }
  ): Promise<GiveChangePayoutResult> {
    const currencyErr = this.validateCurrencyForProvider(
      params.provider,
      params.currency
    );
    if (currencyErr) {
      return this.handlePrecheckError(currencyErr, options);
    }

    const balanceErr = await this.validateAccountForGiveChange(
      params.accountId,
      params.amount
    );
    if (balanceErr) {
      return this.handlePrecheckError(balanceErr, options);
    }

    const callbackUrl = params.callbackUrl || this.buildDefaultCallbackUrl();
    const reference = this.generateReference();
    const provider = params.provider || 'mypvit';

    const transaction = await this.databaseService.createTransaction({
      reference,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      provider,
      payment_method:
        params.paymentMethod === 'card' || params.paymentMethod === 'bank_transfer'
          ? params.paymentMethod
          : 'mobile_money',
      customer_phone: params.customerPhone,
      account_id: params.accountId,
      transaction_type: 'GIVE_CHANGE',
      ...(params.entityId ? { entity_id: params.entityId } : {}),
      ...(params.paymentEntity ? { payment_entity: params.paymentEntity } : {}),
    });

    const holdResult = await this.accountsService.registerHoldIfNotExists({
      accountId: params.accountId,
      amount: params.amount,
      referenceId: transaction.id,
      memo: `GIVE_CHANGE hold - ${reference}`,
    });
    if (!holdResult.success) {
      await this.markFailed(
        transaction.id,
        holdResult.error || 'Failed to reserve payout funds',
        'HOLD_FAILED'
      );
      return this.handlePrecheckError(
        {
          status: HttpStatus.BAD_REQUEST,
          body: {
            success: false,
            message: 'Failed to reserve funds for withdrawal',
            error: 'HOLD_FAILED',
          },
        },
        options
      );
    }

    try {
      return await this.initiateAndFinalize(
        transaction.id,
        reference,
        params,
        callbackUrl,
        options.initiatorUserId ?? params.mtnUserId
      );
    } catch (error: any) {
      await this.failInitiation(
        transaction.id,
        reference,
        params,
        error?.message || 'Withdrawal initiation failed',
        'INITIATION_EXCEPTION'
      );
      if (options.throwOnWithdrawalFailure) {
        throw error instanceof HttpException
          ? error
          : new HttpException(
              {
                success: false,
                message: 'Failed to initiate withdrawal',
                error: 'INITIATION_EXCEPTION',
              },
              HttpStatus.BAD_GATEWAY
            );
      }
      return { success: false };
    }
  }

  private async initiateAndFinalize(
    mobileTxId: string,
    reference: string,
    params: GiveChangePayoutParams,
    callbackUrl: string,
    mtnUserId?: string
  ): Promise<GiveChangePayoutResult> {
    const paymentMethod =
      (params.paymentMethod as 'mobile_money' | 'card' | 'bank_transfer' | undefined) ||
      'mobile_money';
    const paymentResponse = await this.mobilePaymentsService.initiatePayment(
      {
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        customerPhone: params.customerPhone,
        accountId: params.accountId,
        provider: params.provider,
        paymentMethod,
        transactionType: 'GIVE_CHANGE',
        callbackUrl,
      },
      reference,
      mtnUserId
    );
    return this.finalizeAfterProvider(
      mobileTxId,
      reference,
      params,
      paymentResponse
    );
  }

  private async releaseGiveChangeHold(
    accountId: string,
    amount: number,
    mobileTxId: string,
    reference: string
  ): Promise<void> {
    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId,
      amount,
      referenceId: mobileTxId,
      memo: `GIVE_CHANGE release - ${reference}`,
    });
    if (!released.success) {
      this.logger.error(
        `Failed to release GIVE_CHANGE hold for ${mobileTxId}: ${released.error}`
      );
    }
  }

  private handlePrecheckError(
    err: HttpErr,
    options: { throwOnWithdrawalFailure: boolean }
  ): GiveChangePayoutResult {
    if (options.throwOnWithdrawalFailure) {
      throw new HttpException(err.body, err.status);
    }
    this.logger.warn(`Give change precheck failed: ${JSON.stringify(err.body)}`);
    return { success: false };
  }

  /**
   * Mark failed first (so we never leave pending without provider id), then release hold.
   */
  private async failInitiation(
    mobileTxId: string,
    reference: string,
    params: GiveChangePayoutParams,
    message: string | undefined,
    errorCode: string | undefined
  ): Promise<void> {
    await this.markFailed(mobileTxId, message, errorCode);
    await this.releaseGiveChangeHold(
      params.accountId,
      params.amount,
      mobileTxId,
      reference
    );
  }

  private async markFailed(
    mobileTxId: string,
    message: string | undefined,
    errorCode: string | undefined
  ): Promise<void> {
    try {
      await this.databaseService.updateTransaction(mobileTxId, {
        status: 'failed',
        error_message: message,
        error_code: errorCode,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to mark GIVE_CHANGE ${mobileTxId} as failed: ${
          error?.message || error
        }`
      );
    }
  }

  private async finalizeAfterProvider(
    mobileTxId: string,
    reference: string,
    params: GiveChangePayoutParams,
    paymentResponse: MobilePaymentResponse
  ): Promise<GiveChangePayoutResult> {
    const providerTxId = paymentResponse.transactionId?.trim();
    const data = {
      transactionId: mobileTxId,
      providerTransactionId: providerTxId,
      paymentUrl: paymentResponse.paymentUrl,
      message: paymentResponse.message,
      provider: paymentResponse.provider,
    };

    if (!paymentResponse.success || !providerTxId) {
      await this.failInitiation(
        mobileTxId,
        reference,
        params,
        paymentResponse.message,
        paymentResponse.errorCode || 'PROVIDER_INIT_FAILED'
      );
      return { success: false, data };
    }

    // Pending is only valid once we have a provider transaction_id.
    await this.databaseService.updateTransaction(mobileTxId, {
      transaction_id: providerTxId,
      status: 'pending',
    });

    this.logger.log(
      `GIVE_CHANGE ${mobileTxId} initiated (${reference}); funds held until provider confirms`
    );
    return { success: true, data };
  }
}

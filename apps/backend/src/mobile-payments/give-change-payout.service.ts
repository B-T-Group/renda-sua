import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { MobilePaymentsDatabaseService } from './mobile-payments-database.service';
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
    });

    const mtnUserId = options.initiatorUserId ?? params.mtnUserId;
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
      transaction.id,
      reference,
      params,
      paymentResponse,
      options.throwOnWithdrawalFailure
    );
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

  private async finalizeAfterProvider(
    mobileTxId: string,
    reference: string,
    params: GiveChangePayoutParams,
    paymentResponse: MobilePaymentResponse,
    throwOnWithdrawalFailure: boolean
  ): Promise<GiveChangePayoutResult> {
    const data = {
      transactionId: mobileTxId,
      providerTransactionId: paymentResponse.transactionId,
      paymentUrl: paymentResponse.paymentUrl,
      message: paymentResponse.message,
      provider: paymentResponse.provider,
    };

    if (!paymentResponse.success || !paymentResponse.transactionId) {
      await this.databaseService.updateTransaction(mobileTxId, {
        status: 'failed',
        error_message: paymentResponse.message,
        error_code: paymentResponse.errorCode,
      });
      return { success: paymentResponse.success, data };
    }

    await this.databaseService.updateTransaction(mobileTxId, {
      transaction_id: paymentResponse.transactionId,
    });

    const prefix =
      params.withdrawalMemoPrefix || 'Mobile payment give change';
    return this.postProviderWithdraw(
      mobileTxId,
      reference,
      params,
      data,
      prefix,
      throwOnWithdrawalFailure
    );
  }

  private async postProviderWithdraw(
    mobileTxId: string,
    reference: string,
    params: GiveChangePayoutParams,
    data: GiveChangePayoutResult['data'],
    memoPrefix: string,
    throwOnWithdrawalFailure: boolean
  ): Promise<GiveChangePayoutResult> {
    try {
      const withdrawalResult = await this.accountsService.registerTransaction({
        accountId: params.accountId,
        amount: params.amount,
        transactionType: 'withdrawal',
        memo: `${memoPrefix} - ${reference}`,
        referenceId: mobileTxId,
      });

      if (withdrawalResult.success) {
        this.logger.log(
          `Withdrew ${params.amount} ${params.currency} from ${params.accountId} (${memoPrefix})`
        );
        return { success: true, data };
      }

      await this.databaseService.updateTransaction(mobileTxId, {
        status: 'failed',
        error_message: `Withdrawal failed: ${withdrawalResult.error}`,
        error_code: 'WITHDRAWAL_FAILED',
      });
      return this.onWithdrawFail(
        throwOnWithdrawalFailure,
        {
          success: false,
          message: 'Failed to process withdrawal',
          error: 'WITHDRAWAL_FAILED',
          data: {
            accountId: params.accountId,
            amount: params.amount,
            error: withdrawalResult.error,
          },
        },
        `Withdrawal failed for ${params.accountId}: ${withdrawalResult.error}`,
        data
      );
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      await this.databaseService.updateTransaction(mobileTxId, {
        status: 'failed',
        error_message: 'Withdrawal processing error',
        error_code: 'WITHDRAWAL_ERROR',
      });
      return this.onWithdrawFail(
        throwOnWithdrawalFailure,
        {
          success: false,
          message: 'Failed to process withdrawal',
          error: 'WITHDRAWAL_ERROR',
        },
        String(error?.message || error),
        data
      );
    }
  }

  private onWithdrawFail(
    throwOnWithdrawalFailure: boolean,
    body: Record<string, unknown>,
    logMsg: string,
    data: GiveChangePayoutResult['data']
  ): GiveChangePayoutResult {
    if (throwOnWithdrawalFailure) {
      throw new HttpException(body, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    this.logger.error(`Give-change: ${logMsg}`);
    return { success: false, data };
  }
}

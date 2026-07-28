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

    const holdResult = await this.accountsService.registerHoldIfNotExists({
      accountId: params.accountId,
      amount: params.amount,
      referenceId: transaction.id,
      memo: `GIVE_CHANGE hold - ${reference}`,
    });
    if (!holdResult.success) {
      await this.databaseService.updateTransaction(transaction.id, {
        status: 'failed',
        error_message: holdResult.error || 'Failed to reserve payout funds',
        error_code: 'HOLD_FAILED',
      });
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

  private async finalizeAfterProvider(
    mobileTxId: string,
    reference: string,
    params: GiveChangePayoutParams,
    paymentResponse: MobilePaymentResponse,
    _throwOnWithdrawalFailure: boolean
  ): Promise<GiveChangePayoutResult> {
    const data = {
      transactionId: mobileTxId,
      providerTransactionId: paymentResponse.transactionId,
      paymentUrl: paymentResponse.paymentUrl,
      message: paymentResponse.message,
      provider: paymentResponse.provider,
    };

    if (!paymentResponse.success || !paymentResponse.transactionId) {
      await this.releaseGiveChangeHold(
        params.accountId,
        params.amount,
        mobileTxId,
        reference
      );
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

    this.logger.log(
      `GIVE_CHANGE ${mobileTxId} initiated (${reference}); funds held until provider confirms`
    );
    return { success: true, data };
  }
}

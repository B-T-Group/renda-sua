import { Injectable, Logger } from '@nestjs/common';
import { ContextIdFactory } from '@nestjs/core';
import type { Request } from 'express';
import { AccountsService } from '../accounts/accounts.service';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';
import {
  MobilePaymentTransaction,
  MobilePaymentsDatabaseService,
} from './mobile-payments-database.service';
import {
  findPaymentCallbackHandler,
  type PaymentCallbackHandler,
} from './payment-callback/payment-callback-handler.interface';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';

export type MypvitCallbackProcessResult = {
  responseCode: number;
  transactionId: string;
  skipped?: boolean;
};

export type FreemopayCallbackProcessResult = {
  received: boolean;
  reference: string;
  skipped?: boolean;
};

@Injectable()
export class MobilePaymentCallbackProcessor {
  private readonly logger = new Logger(MobilePaymentCallbackProcessor.name);

  constructor(
    private readonly databaseService: MobilePaymentsDatabaseService,
    private readonly accountsService: AccountsService,
    private readonly paymentCallbackRegistry: PaymentCallbackRegistryService
  ) {}

  private async resolveHandlers(req: Request): Promise<PaymentCallbackHandler[]> {
    const contextId = ContextIdFactory.getByRequest(req);
    return this.paymentCallbackRegistry.getHandlers(contextId);
  }

  async processMypvitCallback(
    callbackData: MyPVitCallbackDto,
    req: Request
  ): Promise<MypvitCallbackProcessResult> {
    const tx = await this.databaseService.getTransactionByReference(
      callbackData.merchantReferenceId
    );
    if (tx?.status !== 'pending') {
      if (!tx) {
        await this.databaseService.logCallback(
          callbackData.transactionId,
          callbackData
        );
        this.logger.warn(
          `Transaction not found for reference: ${callbackData.merchantReferenceId}`
        );
        return {
          responseCode: callbackData.code,
          transactionId: callbackData.transactionId,
        };
      }
      this.logger.log(
        `MyPVit callback skipped (already ${tx.status}): ${tx.id}`
      );
      return {
        responseCode: callbackData.code,
        transactionId: callbackData.transactionId,
        skipped: true,
      };
    }

    await this.databaseService.logCallback(
      callbackData.transactionId,
      callbackData
    );

    const isCashRecSuccess =
      callbackData.status === 'SUCCESS' &&
      tx.payment_entity === 'order_cash_reconciliation';

    if (isCashRecSuccess) {
      await this.settleCashReconciliation(tx, callbackData.transactionId, req);
    } else {
      await this.applyMypvitStatusUpdate(tx, callbackData);
      await this.applyMypvitSuccessCredit(tx, callbackData, req);
    }
    await this.applyMypvitFailureSideEffects(tx, callbackData, req);

    return {
      responseCode: callbackData.code,
      transactionId: callbackData.transactionId,
    };
  }

  async processFreemopayCallback(
    callbackData: FreemopayCallbackDto,
    req: Request
  ): Promise<FreemopayCallbackProcessResult> {
    const tx = await this.databaseService.getTransactionByTransactionId(
      callbackData.reference
    );

    if (tx?.status !== 'pending') {
      if (tx) {
        this.logger.log(
          `Freemopay callback skipped (already ${tx.status}): ${tx.id}`
        );
      } else {
        this.logger.warn(
          `Transaction not found for provider reference: ${callbackData.reference}`
        );
      }
      return {
        received: true,
        reference: callbackData.reference,
        skipped: !!tx,
      };
    }

    await this.databaseService.logCallback(tx.id, callbackData);

    const isCashRecSuccess =
      callbackData.status === 'SUCCESS' &&
      tx.payment_entity === 'order_cash_reconciliation';

    if (isCashRecSuccess) {
      await this.settleCashReconciliation(tx, callbackData.reference, req);
    } else {
      await this.applyFreemopayStatusUpdate(tx, callbackData);
      await this.applyFreemopaySuccessCredit(tx, callbackData, req);
    }
    await this.applyFreemopayFailureSideEffects(tx, callbackData, req);

    return { received: true, reference: callbackData.reference };
  }

  private async settleCashReconciliation(
    tx: MobilePaymentTransaction,
    providerTransactionId: string,
    req: Request
  ): Promise<void> {
    const handlers = await this.resolveHandlers(req);
    const handler = findPaymentCallbackHandler(handlers, tx.payment_entity);
    if (!handler) {
      this.logger.warn(
        `No payment callback handler for cash reconciliation entity ${tx.payment_entity}`
      );
      return;
    }
    try {
      await handler.finalizeCashReconciliationAfterPayment(tx);
      await this.databaseService.updateTransaction(tx.id, {
        status: 'success',
        transaction_id: providerTransactionId,
      });
      this.logger.log(`Cash reconciliation settled for mobile tx ${tx.id}`);
    } catch (error: any) {
      this.logger.error(
        `Cash reconciliation finalize failed for ${tx.id}: ${
          error?.message || error
        }`
      );
      throw error;
    }
  }

  private async applyMypvitStatusUpdate(
    transaction: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto
  ): Promise<void> {
    const status = callbackData.status === 'SUCCESS' ? 'success' : 'failed';
    await this.databaseService.updateTransaction(transaction.id, {
      status,
      transaction_id: callbackData.transactionId,
      error_message:
        callbackData.status === 'FAILED' ? 'Payment failed' : undefined,
    });
    this.logger.log(`Updated transaction ${transaction.id} with status: ${status}`);
  }

  private async applyMypvitSuccessCredit(
    transaction: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto,
    req: Request
  ): Promise<void> {
    if (
      callbackData.status !== 'SUCCESS' ||
      !transaction.account_id ||
      transaction.transaction_type !== 'PAYMENT'
    ) {
      return;
    }

    const creditResult = await this.accountsService.registerTransaction({
      accountId: transaction.account_id,
      amount: transaction.amount,
      transactionType: 'deposit',
      memo: `Mobile payment deposit - ${transaction.reference}`,
      referenceId: transaction.id,
    });

    if (!creditResult.success) {
      this.logger.error(
        `Failed to credit account ${transaction.account_id}: ${creditResult.error}`
      );
      return;
    }

    this.logger.log(
      `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
    );

    try {
      const handlers = await this.resolveHandlers(req);
      const handler = findPaymentCallbackHandler(
        handlers,
        transaction.payment_entity
      );
      if (handler) {
        await handler.onPaymentSuccess(transaction);
      }
    } catch (error: any) {
      this.logger.error(
        `Payment finalize failed for account ${transaction.account_id}: ${String(
          error?.message || error
        )}`
      );
    }
  }

  private async applyMypvitFailureSideEffects(
    transaction: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto,
    req: Request
  ): Promise<void> {
    if (callbackData.status !== 'FAILED') {
      return;
    }
    const handlers = await this.resolveHandlers(req);
    const handler = findPaymentCallbackHandler(
      handlers,
      transaction.payment_entity
    );
    if (handler) {
      await handler.onPaymentFailure(transaction, 'Payment failed');
    }
  }

  private async applyFreemopayStatusUpdate(
    transaction: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto
  ): Promise<void> {
    const status = callbackData.status === 'SUCCESS' ? 'success' : 'failed';
    await this.databaseService.updateTransaction(transaction.id, {
      status,
      transaction_id: callbackData.reference,
      error_message:
        callbackData.status === 'FAILED'
          ? callbackData.reason ||
            callbackData.message ||
            'Payment failed'
          : undefined,
    });
    this.logger.log(`Updated transaction ${transaction.id} with status: ${status}`);
  }

  private async applyFreemopaySuccessCredit(
    transaction: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto,
    req: Request
  ): Promise<void> {
    if (
      callbackData.status !== 'SUCCESS' ||
      !transaction.account_id ||
      transaction.transaction_type !== 'PAYMENT'
    ) {
      return;
    }

    const creditResult = await this.accountsService.registerTransaction({
      accountId: transaction.account_id,
      amount: transaction.amount,
      transactionType: 'deposit',
      memo: `Mobile payment deposit - ${transaction.reference}`,
      referenceId: transaction.id,
    });

    if (!creditResult.success) {
      this.logger.error(
        `Failed to credit account ${transaction.account_id}: ${creditResult.error}`
      );
      return;
    }

    this.logger.log(
      `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
    );

    try {
      const handlers = await this.resolveHandlers(req);
      const handler = findPaymentCallbackHandler(
        handlers,
        transaction.payment_entity
      );
      if (handler) {
        await handler.onPaymentSuccess(transaction);
      }
    } catch (error: any) {
      this.logger.error(
        `Payment finalize failed for account ${transaction.account_id}: ${String(
          error?.message || error
        )}`
      );
    }
  }

  private async applyFreemopayFailureSideEffects(
    transaction: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto,
    req: Request
  ): Promise<void> {
    if (callbackData.status !== 'FAILED') {
      return;
    }
    const handlers = await this.resolveHandlers(req);
    const handler = findPaymentCallbackHandler(
      handlers,
      transaction.payment_entity
    );
    if (handler) {
      const failureMessage =
        callbackData.reason || callbackData.message || 'Payment failed';
      await handler.onPaymentFailure(transaction, failureMessage);
    }
  }
}

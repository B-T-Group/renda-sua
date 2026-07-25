import { Injectable, Logger } from '@nestjs/common';
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

  private resolveHandlers(): PaymentCallbackHandler[] {
    return this.paymentCallbackRegistry.getHandlers();
  }

  async processMypvitCallback(
    callbackData: MyPVitCallbackDto,
    _req?: Request
  ): Promise<MypvitCallbackProcessResult> {
    const tx = await this.databaseService.getTransactionByReference(
      callbackData.merchantReferenceId
    );
    if (tx?.status !== 'pending') {
      return this.handleNonPendingMypvit(tx, callbackData);
    }

    await this.databaseService.logCallback(
      callbackData.transactionId,
      callbackData
    );
    await this.processPendingMypvit(tx, callbackData);

    return {
      responseCode: callbackData.code,
      transactionId: callbackData.transactionId,
    };
  }

  async processFreemopayCallback(
    callbackData: FreemopayCallbackDto,
    _req?: Request
  ): Promise<FreemopayCallbackProcessResult> {
    const tx = await this.databaseService.getTransactionByTransactionId(
      callbackData.reference
    );

    if (tx?.status !== 'pending') {
      return this.handleNonPendingFreemopay(tx, callbackData);
    }

    await this.databaseService.logCallback(tx.id, callbackData);
    await this.processPendingFreemopay(tx, callbackData);

    return { received: true, reference: callbackData.reference };
  }

  private async handleNonPendingMypvit(
    tx: MobilePaymentTransaction | null | undefined,
    callbackData: MyPVitCallbackDto
  ): Promise<MypvitCallbackProcessResult> {
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
    if (tx.status === 'success' && callbackData.status === 'SUCCESS') {
      await this.retrySuccessSideEffects(tx);
    }
    this.logger.log(`MyPVit callback skipped (already ${tx.status}): ${tx.id}`);
    return {
      responseCode: callbackData.code,
      transactionId: callbackData.transactionId,
      skipped: true,
    };
  }

  private async handleNonPendingFreemopay(
    tx: MobilePaymentTransaction | null | undefined,
    callbackData: FreemopayCallbackDto
  ): Promise<FreemopayCallbackProcessResult> {
    if (!tx) {
      this.logger.warn(
        `Transaction not found for provider reference: ${callbackData.reference}`
      );
      return { received: true, reference: callbackData.reference };
    }
    if (tx.status === 'success' && callbackData.status === 'SUCCESS') {
      await this.retrySuccessSideEffects(tx);
    }
    this.logger.log(
      `Freemopay callback skipped (already ${tx.status}): ${tx.id}`
    );
    return {
      received: true,
      reference: callbackData.reference,
      skipped: true,
    };
  }

  private async processPendingMypvit(
    tx: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto
  ): Promise<void> {
    if (
      callbackData.status === 'SUCCESS' &&
      tx.payment_entity === 'order_cash_reconciliation'
    ) {
      await this.settleCashReconciliation(tx, callbackData.transactionId);
      return;
    }
    if (callbackData.status === 'SUCCESS' && tx.payment_entity === 'token') {
      await this.finalizeTokenPaymentSuccess(tx, callbackData.transactionId);
      return;
    }
    if (callbackData.status === 'SUCCESS') {
      await this.finalizePaymentSuccess(tx, callbackData.transactionId);
      return;
    }
    await this.applyFailedStatus(tx, callbackData.transactionId, 'Payment failed');
    await this.applyMypvitFailureSideEffects(tx, callbackData);
  }

  private async processPendingFreemopay(
    tx: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto
  ): Promise<void> {
    if (
      callbackData.status === 'SUCCESS' &&
      tx.payment_entity === 'order_cash_reconciliation'
    ) {
      await this.settleCashReconciliation(tx, callbackData.reference);
      return;
    }
    if (callbackData.status === 'SUCCESS' && tx.payment_entity === 'token') {
      await this.finalizeTokenPaymentSuccess(tx, callbackData.reference);
      return;
    }
    if (callbackData.status === 'SUCCESS') {
      await this.finalizePaymentSuccess(tx, callbackData.reference);
      return;
    }
    const failureMessage =
      callbackData.reason || callbackData.message || 'Payment failed';
    await this.applyFailedStatus(tx, callbackData.reference, failureMessage);
    await this.applyFreemopayFailureSideEffects(tx, callbackData);
  }

  private async finalizePaymentSuccess(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    const credited = await this.creditWalletIfNeeded(transaction);
    if (!credited) {
      throw new Error(
        `Wallet credit failed for mobile payment ${transaction.id}; leaving pending for retry`
      );
    }
    await this.runHandlerSuccess(transaction);
    await this.databaseService.updateTransaction(transaction.id, {
      status: 'success',
      transaction_id: providerTransactionId,
    });
    this.logger.log(
      `Updated transaction ${transaction.id} with status: success`
    );
  }

  private async retrySuccessSideEffects(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    if (transaction.transaction_type !== 'PAYMENT') return;
    const credited = await this.creditWalletIfNeeded(transaction);
    if (!credited) {
      this.logger.error(
        `Retry credit still failing for success mobile tx ${transaction.id}`
      );
      return;
    }
    await this.runHandlerSuccess(transaction);
  }

  private async applyFailedStatus(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string,
    errorMessage: string
  ): Promise<void> {
    await this.databaseService.updateTransaction(transaction.id, {
      status: 'failed',
      transaction_id: providerTransactionId,
      error_message: errorMessage,
    });
    this.logger.log(
      `Updated transaction ${transaction.id} with status: failed`
    );
  }

  private async finalizeTokenPaymentSuccess(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    const handlers = this.resolveHandlers();
    const handler = findPaymentCallbackHandler(
      handlers,
      transaction.payment_entity
    );
    if (!handler) {
      throw new Error(
        `No payment callback handler for token entity ${transaction.payment_entity}`
      );
    }
    await handler.onPaymentSuccess(transaction);
    await this.databaseService.updateTransaction(transaction.id, {
      status: 'success',
      transaction_id: providerTransactionId,
    });
    this.logger.log(
      `Token pack payment finalized for business ${transaction.entity_id} (tx ${transaction.id})`
    );
  }

  private async settleCashReconciliation(
    tx: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    const handlers = this.resolveHandlers();
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

  private async creditWalletIfNeeded(
    transaction: MobilePaymentTransaction
  ): Promise<boolean> {
    if (
      !transaction.account_id ||
      transaction.payment_entity === 'token' ||
      transaction.transaction_type !== 'PAYMENT'
    ) {
      return true;
    }

    const alreadyCredited =
      await this.accountsService.hasTransactionForReference({
        accountId: transaction.account_id,
        transactionType: 'deposit',
        referenceId: transaction.id,
      });
    if (alreadyCredited) return true;

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
      return false;
    }

    this.logger.log(
      `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
    );
    return true;
  }

  private async runHandlerSuccess(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    try {
      const handlers = this.resolveHandlers();
      const handler = findPaymentCallbackHandler(
        handlers,
        transaction.payment_entity
      );
      if (handler) {
        await handler.onPaymentSuccess(transaction);
      }
    } catch (error: any) {
      this.logger.error(
        `Payment finalize failed for ${transaction.reference}: ${String(
          error?.message || error
        )}`
      );
    }
  }

  private async applyMypvitFailureSideEffects(
    transaction: MobilePaymentTransaction,
    callbackData: MyPVitCallbackDto
  ): Promise<void> {
    if (callbackData.status !== 'FAILED') {
      return;
    }
    const handlers = this.resolveHandlers();
    const handler = findPaymentCallbackHandler(
      handlers,
      transaction.payment_entity
    );
    if (handler) {
      await handler.onPaymentFailure(transaction, 'Payment failed');
    }
  }

  private async applyFreemopayFailureSideEffects(
    transaction: MobilePaymentTransaction,
    callbackData: FreemopayCallbackDto
  ): Promise<void> {
    if (callbackData.status !== 'FAILED') {
      return;
    }
    const handlers = this.resolveHandlers();
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

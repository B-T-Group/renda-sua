import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { AccountsService } from '../accounts/accounts.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
} from './mobile-payment-callback.dto';
import {
  MobilePaymentTransaction,
  MobilePaymentsDatabaseService,
} from './mobile-payments-database.service';
import { MobilePaymentsService } from './mobile-payments.service';
import {
  findPaymentCallbackHandler,
  type PaymentCallbackHandler,
} from './payment-callback/payment-callback-handler.interface';
import { PaymentCallbackRegistryService } from './payment-callback/payment-callback-registry.service';
import {
  DUPLICATE_PAYMENT_CREDITED,
  LATE_SUCCESS_APPLIED,
  PROVIDER_TERMINAL_ON_RETRY,
  SUPERSEDED_ERROR_CODES,
} from '../orders/pay-after-retry.util';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

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
    private readonly paymentCallbackRegistry: PaymentCallbackRegistryService,
    private readonly mobilePaymentsService: MobilePaymentsService
  ) {}

  /**
   * Check if a transaction was mocked (provider transaction_id starts with mock-).
   */
  private isMockedTransaction(tx: MobilePaymentTransaction): boolean {
    return tx.transaction_id?.startsWith('mock-') ?? false;
  }

  private resolveHandlers(): PaymentCallbackHandler[] {
    return this.paymentCallbackRegistry.getHandlers();
  }

  async processMypvitCallback(
    callbackData: MyPVitCallbackDto,
    _req?: Request
  ): Promise<MypvitCallbackProcessResult> {
    // Try exact match first (backward compatibility or if full reference was sent)
    let tx = await this.databaseService.getTransactionByReference(
      callbackData.merchantReferenceId
    );
    
    // If not found by exact match, try finding by short reference
    // (MyPVIT may have received a shortened reference ≤15 chars)
    if (!tx) {
      tx = await this.databaseService.findMyPVitTransactionByShortReference(
        callbackData.merchantReferenceId
      );
    }
    
    if (tx?.status !== 'pending') {
      return this.handleNonPendingMypvit(tx, callbackData);
    }

    await this.databaseService.logCallback(
      callbackData.transactionId,
      callbackData
    );
    // Callbacks are public and unsigned — confirm provider live status first.
    await this.mobilePaymentsService.assertProviderConfirmsCallback(
      tx,
      callbackData.status
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
    const tx = await this.lookupFreemopayTransaction(callbackData);

    if (tx?.status !== 'pending') {
      return this.handleNonPendingFreemopay(tx, callbackData);
    }

    await this.databaseService.logCallback(tx.id, callbackData);
    
    // Skip live provider confirmation for mocked transactions
    if (callbackData.status === 'SUCCESS' || callbackData.status === 'FAILED') {
      if (!this.isMockedTransaction(tx)) {
        // Callbacks are public and unsigned — confirm provider live status first.
        await this.mobilePaymentsService.assertProviderConfirmsCallback(
          tx,
          callbackData.status
        );
      } else {
        this.logger.log(
          `Skipping live provider confirmation for mocked transaction: ${tx.id}`
        );
      }
    }
    
    await this.processPendingFreemopay(tx, callbackData);

    return { received: true, reference: callbackData.reference };
  }

  private freemopayLookupKeys(callbackData: FreemopayCallbackDto): string[] {
    return [
      ...new Set(
        [callbackData.reference, callbackData.merchantRef, callbackData.externalId]
          .map((key) => key?.trim())
          .filter((key): key is string => !!key)
      ),
    ];
  }

  private async lookupFreemopayKey(
    key: string
  ): Promise<MobilePaymentTransaction | null> {
    const byProviderId =
      await this.databaseService.getTransactionByTransactionId(key);
    if (byProviderId) return byProviderId;
    const byReference = await this.databaseService.getTransactionByReference(key);
    if (byReference) return byReference;
    if (!looksLikeUuid(key)) return null;
    return this.databaseService.getTransactionById(key);
  }

  private async lookupFreemopayTransaction(
    callbackData: FreemopayCallbackDto
  ): Promise<MobilePaymentTransaction | null> {
    for (const key of this.freemopayLookupKeys(callbackData)) {
      const found = await this.lookupFreemopayKey(key);
      if (found) return found;
    }
    return null;
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
    // Resume finalize when SUCCESS arrives on a processing row (crash recovery)
    if (tx.status === 'processing' && callbackData.status === 'SUCCESS') {
      await this.databaseService.logCallback(tx.id, callbackData);
      await this.resumeFinalizeFromProcessing(tx, callbackData.transactionId);
      return {
        responseCode: callbackData.code,
        transactionId: callbackData.transactionId,
      };
    }
    if (this.isRecoverableLateOrderSuccess(tx) && callbackData.status === 'SUCCESS') {
      await this.databaseService.logCallback(tx.id, callbackData);
      await this.handleLateSuccessOnSupersededOrderTx(
        tx,
        callbackData.transactionId
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
        `Transaction not found for provider reference: ${callbackData.reference}` +
          (callbackData.merchantRef
            ? ` merchantRef=${callbackData.merchantRef}`
            : '') +
          (callbackData.externalId
            ? ` externalId=${callbackData.externalId}`
            : '')
      );
      return { received: true, reference: callbackData.reference };
    }
    // Resume finalize when SUCCESS arrives on a processing row (crash recovery)
    if (tx.status === 'processing' && callbackData.status === 'SUCCESS') {
      await this.databaseService.logCallback(tx.id, callbackData);
      await this.resumeFinalizeFromProcessing(tx, callbackData.reference || tx.transaction_id || '');
      return { received: true, reference: callbackData.reference };
    }
    if (this.isRecoverableLateOrderSuccess(tx) && callbackData.status === 'SUCCESS') {
      await this.databaseService.logCallback(tx.id, callbackData);
      await this.handleLateSuccessOnSupersededOrderTx(
        tx,
        callbackData.reference || tx.transaction_id || ''
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

  /** Order attempt we cancelled to make room for a retry (or a late winner), #545. */
  private isSupersededOrderTx(tx: MobilePaymentTransaction): boolean {
    return (
      tx.payment_entity === 'order' &&
      tx.status === 'cancelled' &&
      SUPERSEDED_ERROR_CODES.has(String(tx.error_code || ''))
    );
  }

  /**
   * SUCCESS after we closed the row. Superseded cancels, a retry poll that stored
   * PROVIDER_TERMINAL_ON_RETRY, and a FAILED callback that raced the supersede and
   * left the row failed while keeping a SUPERSEDED_* code.
   */
  private isRecoverableLateOrderSuccess(tx: MobilePaymentTransaction): boolean {
    if (this.isSupersededOrderTx(tx)) return true;
    if (tx.payment_entity !== 'order' || tx.status !== 'failed') return false;
    const code = String(tx.error_code || '');
    return code === PROVIDER_TERMINAL_ON_RETRY || SUPERSEDED_ERROR_CODES.has(code);
  }

  /**
   * The customer approved a prompt we had already superseded. The provider took the
   * money, so it must never be dropped (#545, plan section 3):
   * 1. confirm SUCCESS with the provider (callbacks are unsigned),
   * 2. credit the payer wallet (idempotent on the tx id),
   * 3. let the order decide: first success wins and is applied to the order; a
   *    duplicate or post-cancel success stays in the wallet and raises an alert,
   * 4. only then flip the row cancelled -> success (CAS). A failure before step 4 leaves
   *    it cancelled + superseded, so the provider retry runs this path again.
   */
  private async handleLateSuccessOnSupersededOrderTx(
    tx: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    if (!this.isMockedTransaction(tx)) {
      await this.mobilePaymentsService.assertProviderConfirmsCallback(
        tx,
        'SUCCESS'
      );
    }
    const credited = await this.creditWalletIfNeeded(tx);
    if (!credited) {
      throw new Error(
        `Wallet credit failed for late success on superseded tx ${tx.id}; will retry`
      );
    }
    const handler = findPaymentCallbackHandler(
      this.resolveHandlers(),
      tx.payment_entity
    );
    const outcome = handler?.onLateSuccessAfterSupersede
      ? await handler.onLateSuccessAfterSupersede(tx)
      : 'duplicate';
    const fromStatus = tx.status === 'failed' ? 'failed' : 'cancelled';
    const moved = await this.databaseService.updateTransactionIfStatus(
      tx.id,
      fromStatus,
      {
        status: 'success',
        ...(providerTransactionId ? { transaction_id: providerTransactionId } : {}),
        error_code:
          outcome === 'applied' ? LATE_SUCCESS_APPLIED : DUPLICATE_PAYMENT_CREDITED,
      }
    );
    this.logger.warn(
      `Late success on superseded order tx ${tx.id} (${tx.reference}): ${outcome}${
        moved ? '' : ' (row already moved by a concurrent delivery)'
      }`
    );
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
    if (
      callbackData.status === 'SUCCESS' &&
      (tx.payment_entity === 'token' || tx.payment_entity === 'reel_ai_token')
    ) {
      await this.finalizeTokenPaymentSuccess(tx, callbackData.transactionId);
      return;
    }
    if (callbackData.status === 'SUCCESS') {
      await this.finalizePaymentSuccess(tx, callbackData.transactionId);
      return;
    }
    await this.failPendingAttempt(tx, callbackData.transactionId, 'Payment failed', () =>
      this.applyMypvitFailureSideEffects(tx, callbackData)
    );
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
    if (
      callbackData.status === 'SUCCESS' &&
      (tx.payment_entity === 'token' || tx.payment_entity === 'reel_ai_token')
    ) {
      await this.finalizeTokenPaymentSuccess(tx, callbackData.reference);
      return;
    }
    if (callbackData.status === 'SUCCESS') {
      await this.finalizePaymentSuccess(tx, callbackData.reference);
      return;
    }
    const failureMessage =
      callbackData.reason || callbackData.message || 'Payment failed';
    await this.failPendingAttempt(tx, callbackData.reference, failureMessage, () =>
      this.applyFreemopayFailureSideEffects(tx, callbackData)
    );
  }

  private async finalizePaymentSuccess(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    if (transaction.transaction_type === 'GIVE_CHANGE') {
      await this.finalizeGiveChangeSuccess(transaction, providerTransactionId);
      return;
    }

    if (transaction.payment_entity === 'order') {
      await this.finalizeOrderPaymentSuccess(transaction, providerTransactionId);
      return;
    }
    await this.finalizeNonOrderPaymentSuccess(transaction, providerTransactionId);
  }

  /**
   * GIVE_CHANGE success: claim pending→processing with CAS, debit with idempotency,
   * then mark success. Never overwrite FAILED (provider may callback late after we timed it out).
   */
  private async finalizeGiveChangeSuccess(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    const claimed = await this.databaseService.updateTransactionIfStatus(
      transaction.id,
      'pending',
      { status: 'processing' }
    );
    if (!claimed) {
      const fresh = await this.databaseService.getTransactionById(transaction.id);
      if (fresh?.status === 'processing') {
        this.logger.log(
          `GIVE_CHANGE ${transaction.id} CAS lost to concurrent SUCCESS; left unchanged`
        );
        return;
      }
      if (fresh?.status === 'failed') {
        this.logger.warn(
          `GIVE_CHANGE ${transaction.id} SUCCESS callback after FAILED status; not overwriting`
        );
        return;
      }
      this.logger.log(
        `GIVE_CHANGE ${transaction.id} not pending (status=${fresh?.status ?? 'missing'}); skipped`
      );
      return;
    }
    const debited = await this.debitWalletIfNeeded(transaction);
    if (!debited) {
      await this.databaseService.updateTransactionIfStatus(transaction.id, 'processing', {
        status: 'failed',
        transaction_id: providerTransactionId,
        error_message:
          'Provider payout succeeded but wallet debit failed; manual reconciliation required',
        error_code: 'WITHDRAWAL_FAILED',
      });
      this.logger.error(
        `GIVE_CHANGE ${transaction.id} provider success with ledger debit failure`
      );
      return;
    }
    const markedSuccess = await this.databaseService.updateTransactionIfStatus(
      transaction.id,
      'processing',
      {
        status: 'success',
        transaction_id: providerTransactionId,
      }
    );
    if (!markedSuccess) {
      // Row left processing; re-read
      const fresh = await this.databaseService.getTransactionById(transaction.id);
      if (fresh?.status === 'success') {
        this.logger.log(
          `GIVE_CHANGE ${transaction.id} already marked success by concurrent writer`
        );
        return;
      }
      this.logger.warn(
        `GIVE_CHANGE ${transaction.id} processing→success CAS lost; status=${fresh?.status ?? 'missing'}`
      );
      return;
    }
    this.logger.log(
      `GIVE_CHANGE ${transaction.id} finalized with wallet debit`
    );
  }

  /**
   * Order MoMo success (#545 QA F2, money race fix). The row is claimed pending -> processing
   * with a CAS BEFORE any money moves, so only the writer that wins may credit the wallet.
   * Then the payment is flipped processing -> success and the order is finalized. A racing
   * retry or duplicate SUCCESS that loses the claim leaves everything unchanged. If wallet
   * credit or finalizing throws, the claim is undone (processing -> pending) so the provider
   * retry runs the whole path again.
   */
  private async finalizeOrderPaymentSuccess(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    const claimed = await this.databaseService.updateTransactionIfStatus(
      transaction.id,
      'pending',
      { status: 'processing' }
    );
    if (!claimed) {
      await this.routeUnclaimedOrderSuccess(transaction, providerTransactionId);
      return;
    }
    try {
      const credited = await this.creditWalletIfNeeded(transaction);
      if (!credited) {
        await this.databaseService
          .updateTransactionIfStatus(transaction.id, 'processing', { status: 'pending' })
          .catch((e: any) =>
            this.logger.error(
              `Could not release processing claim after credit failure on ${transaction.id}: ${e?.message ?? e}`
            )
          );
        throw new Error(
          `Wallet credit failed for order payment ${transaction.id}; leaving pending for retry`
        );
      }
      const markedSuccess = await this.databaseService.updateTransactionIfStatus(
        transaction.id,
        'processing',
        {
          status: 'success',
          ...(providerTransactionId ? { transaction_id: providerTransactionId } : {}),
        }
      );
      if (!markedSuccess) {
        // Row left processing between credit and success mark: re-read and route
        await this.routeUnclaimedOrderSuccess(transaction, providerTransactionId);
        return;
      }
      await this.runHandlerSuccess(transaction);
    } catch (error) {
      // Only roll back if credit failed (before wallet was credited).
      // After credit, leave the row in processing for recovery.
      if ((error as Error).message?.includes('Wallet credit failed')) {
        throw error;
      }
      // Handler threw after wallet was credited; leave row in processing for recovery
      this.logger.error(
        `Handler failed after wallet credit for ${transaction.id}; leaving processing for recovery: ${(error as any)?.message ?? error}`
      );
      throw error;
    }
    this.logger.log(`Updated transaction ${transaction.id} with status: success`);
  }

  /** The row left 'pending' between our read and the claim: re-read and route it. */
  private async routeUnclaimedOrderSuccess(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    const fresh = await this.databaseService.getTransactionById(transaction.id);
    if (fresh && this.isRecoverableLateOrderSuccess(fresh)) {
      await this.handleLateSuccessOnSupersededOrderTx(fresh, providerTransactionId);
      return;
    }
    if (fresh?.status === 'success') {
      await this.retrySuccessSideEffects(fresh);
      return;
    }
    // Concurrent writer holds the processing claim; this writer never credited
    if (fresh?.status === 'processing') {
      this.logger.log(
        `Order payment ${transaction.id} CAS lost to concurrent processing claim; left unchanged`
      );
      return;
    }
    // Provider confirmed SUCCESS but our row is failed / cancelled for another reason:
    // the wallet is already credited (idempotent), so the money is safe; flag it.
    reportMoneyAnomaly(
      this.logger,
      'payment_finalize_failed',
      `Order MoMo success on non-pending row ${transaction.id} (status=${fresh?.status ?? 'missing'}, error_code=${fresh?.error_code ?? ''}); amount left in wallet`,
      {
        transactionId: transaction.id,
        paymentEntity: transaction.payment_entity,
        entityId: transaction.entity_id,
        replay: false,
      }
    );
  }

  /**
   * Non-order MoMo success (money race fix). Claim pending -> processing with a CAS BEFORE
   * any money moves, so only the writer that wins may credit the wallet. A racing duplicate
   * SUCCESS that loses the claim leaves everything unchanged.
   */
  private async finalizeNonOrderPaymentSuccess(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    const claimed = await this.databaseService.updateTransactionIfStatus(
      transaction.id,
      'pending',
      { status: 'processing' }
    );
    if (!claimed) {
      await this.routeUnclaimedNonOrderSuccess(transaction);
      return;
    }
    try {
      const credited = await this.creditWalletIfNeeded(transaction);
      if (!credited) {
        await this.databaseService
          .updateTransactionIfStatus(transaction.id, 'processing', { status: 'pending' })
          .catch((e: any) =>
            this.logger.error(
              `Could not release processing claim after credit failure on ${transaction.id}: ${e?.message ?? e}`
            )
          );
        throw new Error(
          `Wallet credit failed for mobile payment ${transaction.id}; leaving pending for retry`
        );
      }
      const markedSuccess = await this.databaseService.updateTransactionIfStatus(
        transaction.id,
        'processing',
        {
          status: 'success',
          ...(providerTransactionId ? { transaction_id: providerTransactionId } : {}),
        }
      );
      if (!markedSuccess) {
        // Row left processing between credit and success mark: route to retry handler
        await this.routeUnclaimedNonOrderSuccess(transaction);
        return;
      }
      await this.runHandlerSuccess(transaction);
    } catch (error) {
      // Only roll back if credit failed (before wallet was credited).
      // After credit, leave the row in processing for recovery.
      if ((error as Error).message?.includes('Wallet credit failed')) {
        throw error;
      }
      // Handler threw after wallet was credited; leave row in processing for recovery
      this.logger.error(
        `Handler failed after wallet credit for ${transaction.id}; leaving processing for recovery: ${(error as any)?.message ?? error}`
      );
      throw error;
    }
    this.logger.log(
      `Updated transaction ${transaction.id} with status: success`
    );
  }

  private async routeUnclaimedNonOrderSuccess(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    const fresh = await this.databaseService.getTransactionById(transaction.id);
    if (fresh?.status === 'success') {
      await this.retrySuccessSideEffects(fresh);
      return;
    }
    this.logger.log(
      `Non-order payment ${transaction.id} CAS lost (concurrent duplicate SUCCESS); left unchanged`
    );
  }

  /**
   * Resume finalize when SUCCESS arrives on a processing row (crash after claim).
   * Skip the claim (already processing), then idempotently credit → mark success → handler.
   * Note: resume skips assertProviderConfirmsCallback because a row only reaches processing
   * after a confirmed SUCCESS in the first finalize attempt.
   */
  /**
   * Resume finalize when SUCCESS arrives on a processing row (crash recovery).
   * Skip the claim (already processing), then idempotently credit → mark success → handler.
   * Note: resume skips assertProviderConfirmsCallback because a row only reaches processing
   * after a confirmed SUCCESS in the first finalize attempt.
   */
  private async resumeFinalizeFromProcessing(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    this.logger.log(
      `Resuming finalize for processing tx ${transaction.id} (crash recovery)`
    );
    // Wallet credit is idempotent on the transaction id
    const credited = await this.creditWalletIfNeeded(transaction);
    if (!credited) {
      // Credit failed; leave the row in processing (not pending) because
      // the wallet might have been credited before the crash.
      throw new Error(
        `Wallet credit failed while resuming ${transaction.id}; leaving processing for recovery`
      );
    }
    // Mark processing → success
    const markedSuccess = await this.databaseService.updateTransactionIfStatus(
      transaction.id,
      'processing',
      {
        status: 'success',
        ...(providerTransactionId ? { transaction_id: providerTransactionId } : {}),
      }
    );
    if (!markedSuccess) {
      // Row left processing between our read and this call; re-read and route
      const fresh = await this.databaseService.getTransactionById(transaction.id);
      if (fresh?.status === 'success') {
        await this.retrySuccessSideEffects(fresh);
        return;
      }
      this.logger.log(
        `Resume finalize: processing→success CAS lost for ${transaction.id}; left unchanged`
      );
      return;
    }
    // Run handler (idempotent for order/order_deposit first pass, alerts on failure)
    try {
      await this.runHandlerSuccess(transaction);
    } catch (error: any) {
      // Handler threw after wallet was credited and success mark; leave row in processing for recovery
      this.logger.error(
        `Handler failed after success mark for ${transaction.id}; leaving processing for recovery: ${error?.message ?? error}`
      );
      throw error;
    }
  }

  /**
   * Recover a stale processing row. Check if wallet was credited; if so, finalize.
   * Otherwise query provider status and finalize or fail accordingly.
   */
  async recoverStaleProcessingTransaction(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    this.logger.log(`Recovering stale processing tx ${transaction.id}`);
    
    // Check if wallet deposit exists (idempotent key: momo-deposit:<tx id>)
    const walletCredited = await this.databaseService.hasWalletDepositForTransaction(
      transaction.id
    );
    
    if (walletCredited) {
      this.logger.log(
        `Wallet deposit found for ${transaction.id}; marking success and running handler`
      );
      // Wallet was credited; mark success and run handler
      const markedSuccess = await this.databaseService.updateTransactionIfStatus(
        transaction.id,
        'processing',
        { status: 'success' }
      );
      if (markedSuccess) {
        try {
          await this.runHandlerSuccess(transaction);
        } catch (error: any) {
          this.logger.error(
            `Handler failed after recovery for ${transaction.id}: ${error?.message ?? error}`
          );
        }
      }
      return;
    }
    
    // Wallet not credited; query provider status
    try {
      const providerStatus = await this.mobilePaymentsService.checkTransactionStatus(
        transaction.id,
        transaction.provider
      );
      
      if (providerStatus.status === 'success') {
        this.logger.log(
          `Provider confirms SUCCESS for ${transaction.id}; resuming finalize`
        );
        await this.resumeFinalizeFromProcessing(
          transaction,
          providerStatus.transactionId || transaction.transaction_id || ''
        );
      } else if (providerStatus.status === 'failed' || providerStatus.status === 'cancelled') {
        this.logger.log(
          `Provider confirms ${providerStatus.status} for ${transaction.id}; marking failed`
        );
        await this.databaseService.updateTransactionIfStatus(
          transaction.id,
          'processing',
          {
            status: 'failed',
            error_message: providerStatus.message || 'Payment failed',
          }
        );
      } else {
        // Still pending or ambiguous; leave as processing for next recovery attempt
        this.logger.log(
          `Provider status ${providerStatus.status} for ${transaction.id}; leaving processing for next recovery`
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to query provider status for recovery of ${transaction.id}: ${error?.message ?? error}`
      );
      // Leave as processing for next recovery attempt
    }
  }

  private async retrySuccessSideEffects(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    if (transaction.transaction_type === 'GIVE_CHANGE') {
      const debited = await this.debitWalletIfNeeded(transaction);
      if (!debited) {
        this.logger.error(
          `Retry debit still failing for success GIVE_CHANGE tx ${transaction.id}`
        );
      }
      return;
    }
    if (transaction.transaction_type !== 'PAYMENT') return;
    const credited = await this.creditWalletIfNeeded(transaction);
    if (!credited) {
      this.logger.error(
        `Retry credit still failing for success mobile tx ${transaction.id}`
      );
      return;
    }
    if (this.isTokenPackEntity(transaction.payment_entity)) return;
    // Replay of an already-success tx: a handler failure is alerted inside
    // runHandlerSuccess and the next provider replay retries again.
    await this.runHandlerSuccess(transaction, { replay: true });
  }

  private isTokenPackEntity(paymentEntity?: string | null): boolean {
    return paymentEntity === 'token' || paymentEntity === 'reel_ai_token';
  }

  /**
   * Only the writer that still sees pending may fail the row. A racing retry CAS
   * pending → cancelled (SUPERSEDED_*) or SUCCESS pending → success must win; an
   * unconditional FAILED write used to clobber those and drop a later debit.
   */
  private async failPendingAttempt(
    tx: MobilePaymentTransaction,
    providerTransactionId: string,
    errorMessage: string,
    onMoved: () => Promise<void>
  ): Promise<void> {
    const moved = await this.applyFailedStatus(tx, providerTransactionId, errorMessage);
    if (!moved) {
      return;
    }
    await this.releaseGiveChangeHoldIfNeeded(tx);
    await this.reverseWalletIfDebitedLegacy(tx);
    await onMoved();
  }

  private async applyFailedStatus(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string,
    errorMessage: string
  ): Promise<boolean> {
    const moved = await this.databaseService.updateTransactionIfStatus(
      transaction.id,
      'pending',
      {
        status: 'failed',
        transaction_id: providerTransactionId,
        error_message: errorMessage,
      }
    );
    this.logger.log(
      moved
        ? `Updated transaction ${transaction.id} with status: failed`
        : `FAILED callback CAS lost for ${transaction.id}; left row unchanged`
    );
    return moved;
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

  private async debitWalletIfNeeded(
    transaction: MobilePaymentTransaction
  ): Promise<boolean> {
    if (
      !transaction.account_id ||
      transaction.transaction_type !== 'GIVE_CHANGE'
    ) {
      return true;
    }

    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId: transaction.account_id,
      amount: transaction.amount,
      referenceId: transaction.id,
      memo: `GIVE_CHANGE release - ${transaction.reference}`,
    });
    if (!released.success) {
      this.logger.error(
        `Failed to release GIVE_CHANGE hold for ${transaction.id}: ${released.error}`
      );
      return false;
    }

    const withdrawalResult =
      await this.accountsService.registerWithdrawalIfNotExists({
        accountId: transaction.account_id,
        amount: transaction.amount,
        referenceId: transaction.id,
        memo: `Mobile payment give change - ${transaction.reference}`,
        idempotencyKey: `momo-giveout:${transaction.id}`,
      });

    if (!withdrawalResult.success) {
      this.logger.error(
        `Failed to debit account ${transaction.account_id}: ${withdrawalResult.error}`
      );
      return false;
    }

    if (!withdrawalResult.alreadyExists) {
      this.logger.log(
        `Withdrew ${transaction.amount} ${transaction.currency} from ${transaction.account_id} (GIVE_CHANGE ${transaction.reference})`
      );
    }
    return true;
  }

  private async releaseGiveChangeHoldIfNeeded(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    if (
      !transaction.account_id ||
      transaction.transaction_type !== 'GIVE_CHANGE'
    ) {
      return;
    }
    const released = await this.accountsService.registerReleaseIfNotExists({
      accountId: transaction.account_id,
      amount: transaction.amount,
      referenceId: transaction.id,
      memo: `GIVE_CHANGE release - ${transaction.reference}`,
    });
    if (!released.success) {
      this.logger.error(
        `Failed to release GIVE_CHANGE hold for ${transaction.id}: ${released.error}`
      );
    }
  }

  private async reverseWalletIfDebitedLegacy(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    if (
      !transaction.account_id ||
      transaction.transaction_type !== 'GIVE_CHANGE'
    ) {
      return;
    }

    const wasDebited = await this.accountsService.hasTransactionForReference({
      accountId: transaction.account_id,
      transactionType: 'withdrawal',
      referenceId: transaction.id,
    });
    if (!wasDebited) {
      return;
    }

    const reversal = await this.accountsService.registerDepositIfNotExists({
      accountId: transaction.account_id,
      amount: transaction.amount,
      memo: `GIVE_CHANGE reversal - ${transaction.reference}`,
      referenceId: transaction.id,
      idempotencyKey: `momo-reversal:${transaction.id}`,
    });
    if (!reversal.success) {
      this.logger.error(
        `Failed to reverse legacy GIVE_CHANGE debit for ${transaction.id}: ${reversal.error}`
      );
      return;
    }
    if (reversal.alreadyExists) return;
    this.logger.log(
      `Reversed legacy GIVE_CHANGE wallet debit for ${transaction.id}`
    );
  }

  private async creditWalletIfNeeded(
    transaction: MobilePaymentTransaction
  ): Promise<boolean> {
    if (
      !transaction.account_id ||
      transaction.payment_entity === 'token' ||
      transaction.payment_entity === 'reel_ai_token' ||
      transaction.payment_entity === 'order_deposit' ||
      transaction.transaction_type !== 'PAYMENT'
    ) {
      return true;
    }

    const creditResult = await this.accountsService.registerDepositIfNotExists({
      accountId: transaction.account_id,
      amount: transaction.amount,
      memo: `Mobile payment deposit - ${transaction.reference}`,
      referenceId: transaction.id,
      idempotencyKey: `momo-deposit:${transaction.id}`,
      ...(transaction.payment_entity === 'order' ||
      transaction.payment_entity === 'claim_order'
        ? { skipCashAdvanceRepayment: true }
        : {}),
    });

    if (!creditResult.success) {
      this.logger.error(
        `Failed to credit account ${transaction.account_id}: ${creditResult.error}`
      );
      return false;
    }
    if (creditResult.alreadyExists) return true;

    this.logger.log(
      `Successfully credited account ${transaction.account_id} with ${transaction.amount} ${transaction.currency}`
    );
    return true;
  }

  /**
   * Run the entity success handler. A failure is always alerted (reportMoneyAnomaly).
   * For `order_deposit`, and for `order` or `claim_order` on the first (pending -> success)
   * pass, it is rethrown so the transaction is NOT marked success and stays pending: the wallet credit
   * is idempotent on the transaction id, so the provider replay / pending reconciler
   * re-runs the handler instead of leaving a paid-but-unpaid-order silently (UAT S-8).
   * On replays of an already-success tx the error is only alerted (no endless 5xx).
   */
  private async runHandlerSuccess(
    transaction: MobilePaymentTransaction,
    options: { replay?: boolean } = {}
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
      reportMoneyAnomaly(
        this.logger,
        'payment_finalize_failed',
        `entity=${transaction.payment_entity} reference=${transaction.reference} entityId=${transaction.entity_id} txId=${transaction.id}${
          options.replay ? ' (replay)' : ''
        }: ${String(error?.message || error)}`,
        {
          transactionId: transaction.id,
          paymentEntity: transaction.payment_entity,
          entityId: transaction.entity_id,
          replay: options.replay === true,
        }
      );
      const firstPassOrder =
        (transaction.payment_entity === 'order' ||
          transaction.payment_entity === 'claim_order') &&
        options.replay !== true;
      if (transaction.payment_entity === 'order_deposit' || firstPassOrder) {
        throw error;
      }
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

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Request } from 'express';
import { AccountsService } from '../accounts/accounts.service';
import { reportMoneyAnomaly } from '../common/utils/money-alert.util';
import type {
  FreemopayCallbackDto,
  MyPVitCallbackDto,
  FedaPayCallbackDto,
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

/** Set when success→processing after a failed order/claim/deposit handler. */
export const FINALIZE_HANDLER_FAILED = 'FINALIZE_HANDLER_FAILED';
const PROCESSING_RESUME_STALE_MS = 60_000;

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
    private readonly mobilePaymentsService: MobilePaymentsService,
    private readonly moduleRef: ModuleRef
  ) {}

  /**
   * Check if a transaction was mocked (provider transaction_id starts with mock-).
   */
  private isMockedTransaction(tx: MobilePaymentTransaction): boolean {
    return tx.transaction_id?.startsWith('mock-') ?? false;
  }

  /**
   * G1: Check if FedaPay mock mode is currently enabled.
   * Fail closed: if we can't resolve the service, assume mock is off.
   */
  private isFedaPayMockEnabled(): boolean {
    try {
      const FedaPayService = require('./providers/fedapay.service').FedaPayService;
      const fedapay = this.moduleRef.get(FedaPayService, { strict: false });
      return fedapay?.['mockEnabled'] === true;
    } catch {
      return false;
    }
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

  async processFedaPayCallback(
    callbackData: FedaPayCallbackDto,
    _req?: Request
  ): Promise<{ received: boolean; transactionId: number }> {
    // FedaPay docs (docs.fedapay.com/en/integration-api/collects-management, "Collect Lifecycle"):
    // 'expired' = "the collect was not completed within the allowed time frame" (unpaid collections expire after 24h).
    // Handle both transaction.expired event and transaction.updated with status 'expired'.
    const TERMINAL_EVENTS = ['transaction.approved', 'transaction.declined', 'transaction.canceled', 'transaction.updated', 'transaction.expired'];
    const TERMINAL_STATUSES = ['approved', 'declined', 'canceled', 'expired'];
    
    const isTerminalEvent = TERMINAL_EVENTS.includes(callbackData.name) &&
      (callbackData.name === 'transaction.expired' || 
       callbackData.name !== 'transaction.updated' || 
       callbackData.entity.status === 'expired');
    const isTerminalStatus = TERMINAL_STATUSES.includes(callbackData.entity.status);
    
    if (!isTerminalEvent || !isTerminalStatus) {
      this.logger.log(
        `FedaPay non-terminal event: name=${callbackData.name} status=${callbackData.entity.status} entity_id=${callbackData.entity.id}, acknowledging without state change`
      );
      return { received: true, transactionId: callbackData.entity.id };
    }

    const tx = await this.lookupFedaPayTransaction(callbackData);

    if (tx?.status !== 'pending') {
      return this.handleNonPendingFedaPay(tx, callbackData);
    }

    await this.databaseService.logCallback(tx.id, callbackData);
    
    const normalizedStatus = callbackData.entity.status === 'approved' 
      ? 'SUCCESS' 
      : callbackData.entity.status === 'declined' 
      ? 'FAILED' 
      : ['canceled', 'expired'].includes(callbackData.entity.status)
      ? 'FAILED'
      : null;

    if (!normalizedStatus) {
      this.logger.warn(
        `FedaPay unexpected terminal status: ${callbackData.entity.status} for tx ${tx.id}`
      );
      return { received: true, transactionId: callbackData.entity.id };
    }

    if (!this.isMockedTransaction(tx)) {
      await this.mobilePaymentsService.assertProviderConfirmsCallback(
        this.withFedaPayRecheckId(tx, callbackData),
        normalizedStatus
      );
    } else {
      this.logger.log(
        `Skipping live provider confirmation for mocked transaction: ${tx.id}`
      );
    }
    
    await this.processPendingFedaPay(tx, callbackData);

    return { received: true, transactionId: callbackData.entity.id };
  }

  /**
   * N2: a FedaPay row can be pending without a transaction_id (the provider id
   * was never stored, e.g. the push failed or the process died right after
   * Transaction.create). The webhook was matched by custom_metadata.externalId,
   * so re-check the live status of the webhook's entity id instead of failing
   * with "missing provider transaction_id". This is safe only because the live
   * re-check requires custom_metadata.externalId === tx.reference (fail closed),
   * so it is used only when the row has a reference. The finalizers then store
   * the entity id as transaction_id.
   */
  private withFedaPayRecheckId(
    tx: MobilePaymentTransaction,
    callbackData: FedaPayCallbackDto
  ): MobilePaymentTransaction {
    if (tx.transaction_id?.trim()) return tx;
    const entityId = callbackData.entity?.id;
    if (!tx.reference?.trim() || entityId === undefined || entityId === null) {
      return tx;
    }
    this.logger.warn(
      `FedaPay row ${tx.id} has no transaction_id; re-checking webhook entity ${entityId} (reference must match)`
    );
    return { ...tx, transaction_id: String(entityId) };
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

  private fedapayLookupKeys(callbackData: FedaPayCallbackDto): string[] {
    const entityId = String(callbackData.entity.id);
    const externalId = callbackData.entity.custom_metadata?.externalId;
    return [
      ...new Set(
        [entityId, externalId, callbackData.entity.reference]
          .map((key) => key?.trim())
          .filter((key): key is string => !!key)
      ),
    ];
  }

  private async lookupFedaPayKey(
    key: string
  ): Promise<MobilePaymentTransaction | null> {
    // FedaPay ids are plain numbers and can collide with another provider's
    // transaction_id/reference, so only ever match FedaPay rows here.
    // Exclude GIVE_CHANGE rows: they hold payout ids, not transaction ids.
    // FedaPay payout and transaction ids are separate sequences and can collide.
    // DEV mock payouts (transaction_id "mock-…") are resolved by FedaPayService's
    // auto-callback through this same path, so keep matching those, but only when
    // mock mode is actually on (G1).
    const isFedaPayCollection = (tx: MobilePaymentTransaction | null | undefined) => {
      if (tx?.provider !== 'fedapay') return null;
      if (tx.transaction_type === 'GIVE_CHANGE') {
        const isMocked = this.isMockedTransaction(tx);
        if (!isMocked) return null;
        if (!this.isFedaPayMockEnabled()) return null;
      }
      return tx;
    };
    const byProviderId = isFedaPayCollection(
      await this.databaseService.getTransactionByTransactionId(key)
    );
    if (byProviderId) return byProviderId;
    const byReference = isFedaPayCollection(
      await this.databaseService.getTransactionByReference(key)
    );
    if (byReference) return byReference;
    if (!looksLikeUuid(key)) return null;
    return isFedaPayCollection(await this.databaseService.getTransactionById(key));
  }

  private async lookupFedaPayTransaction(
    callbackData: FedaPayCallbackDto
  ): Promise<MobilePaymentTransaction | null> {
    for (const key of this.fedapayLookupKeys(callbackData)) {
      const found = await this.lookupFedaPayKey(key);
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

  private async handleNonPendingFedaPay(
    tx: MobilePaymentTransaction | null | undefined,
    callbackData: FedaPayCallbackDto
  ): Promise<{ received: boolean; transactionId: number }> {
    if (!tx) {
      this.logger.warn(
        `Transaction not found for FedaPay entity: ${callbackData.entity.id}`
      );
      return { received: true, transactionId: callbackData.entity.id };
    }
    const isApproved = callbackData.entity.status === 'approved';
    // Resume finalize when approved arrives on a processing row (crash recovery)
    if (tx.status === 'processing' && isApproved) {
      await this.databaseService.logCallback(tx.id, callbackData);
      await this.resumeFinalizeFromProcessing(tx, String(callbackData.entity.id));
      return { received: true, transactionId: callbackData.entity.id };
    }
    if (this.isRecoverableLateOrderSuccess(tx) && isApproved) {
      await this.databaseService.logCallback(tx.id, callbackData);
      await this.handleLateSuccessOnSupersededOrderTx(
        tx,
        String(callbackData.entity.id)
      );
      return { received: true, transactionId: callbackData.entity.id };
    }
    // F3: Handle approve-after-decline/cancel for top-ups (PAYMENT type).
    // Re-check live with FedaPay, then credit exactly once if confirmed.
    if (tx.status === 'failed' && isApproved && tx.transaction_type === 'PAYMENT') {
      await this.databaseService.logCallback(tx.id, callbackData);
      await this.handleLateSuccessOnFailedTopUp(tx, callbackData);
      return { received: true, transactionId: callbackData.entity.id };
    }
    if (tx.status === 'success' && isApproved) {
      await this.retrySuccessSideEffects(tx);
    }
    this.logger.log(
      `FedaPay callback skipped (already ${tx.status}): ${tx.id}`
    );
    return {
      received: true,
      transactionId: callbackData.entity.id,
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

  /**
   * F3: Handle approve-after-decline for wallet top-up rows ONLY.
   * Re-check live, CAS claim BEFORE credit, keep transaction_id.
   */
  private async handleLateSuccessOnFailedTopUp(
    tx: MobilePaymentTransaction,
    callbackData: FedaPayCallbackDto
  ): Promise<void> {
    // F3: Limit to wallet top-ups only
    if (tx.payment_entity !== 'wallet') {
      this.logger.warn(
        `Late success on failed ${tx.payment_entity} tx ${tx.id}: not wallet, skipping`
      );
      return;
    }

    if (!this.isMockedTransaction(tx)) {
      await this.mobilePaymentsService.assertProviderConfirmsCallback(
        tx,
        'SUCCESS'
      );
    }

    // F3: CAS claim failed→processing BEFORE crediting
    const claimed = await this.databaseService.updateTransactionIfStatus(
      tx.id,
      'failed',
      { status: 'processing' }
    );

    if (!claimed) {
      this.logger.warn(
        `Late success on failed top-up ${tx.id}: concurrent claim won`
      );
      return;
    }

    const credited = await this.creditWalletIfNeeded(tx);
    if (!credited) {
      await this.databaseService.updateTransaction(tx.id, { status: 'failed' });
      throw new Error(
        `Wallet credit failed for late success on failed top-up ${tx.id}; will retry`
      );
    }

    // F3: Mark success, KEEP the stored transaction_id (don't overwrite)
    await this.databaseService.updateTransaction(tx.id, {
      status: 'success',
      error_code: LATE_SUCCESS_APPLIED,
    });

    this.logger.warn(
      `Late success on failed top-up ${tx.id} (${tx.reference}): claimed, credited, success`
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

  private async processPendingFedaPay(
    tx: MobilePaymentTransaction,
    callbackData: FedaPayCallbackDto
  ): Promise<void> {
    // F-L3: Preserve mock- transaction_id; don't overwrite with synthetic numeric id
    const isMock = this.isMockedTransaction(tx);
    const providerTxId = isMock && callbackData.entity.reference?.startsWith('mock-')
      ? callbackData.entity.reference
      : String(callbackData.entity.id);
    const isApproved = callbackData.entity.status === 'approved';
    
    if (
      isApproved &&
      tx.payment_entity === 'order_cash_reconciliation'
    ) {
      await this.settleCashReconciliation(tx, providerTxId);
      return;
    }
    if (
      isApproved &&
      (tx.payment_entity === 'token' || tx.payment_entity === 'reel_ai_token')
    ) {
      await this.finalizeTokenPaymentSuccess(tx, providerTxId);
      return;
    }
    if (isApproved) {
      await this.finalizePaymentSuccess(tx, providerTxId);
      return;
    }
    const failureMessage = String(callbackData.entity.status || 'Payment declined');
    await this.failPendingAttempt(tx, providerTxId, failureMessage, () =>
      this.applyFedaPayFailureSideEffects(tx, callbackData)
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
        status: 'success',
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
   * retry or duplicate SUCCESS that loses the claim leaves everything unchanged. A failed
   * wallet credit returns the row to pending. A failed order handler returns it to
   * processing so the next SUCCESS resumes instead of looking already paid.
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
    const credited = await this.creditWalletIfNeeded(transaction);
    if (!credited) {
      await this.releaseProcessingClaimAfterCreditFailure(transaction.id);
      throw new Error(
        `Wallet credit failed for order payment ${transaction.id}; leaving pending for retry`
      );
    }
    const markedSuccess = await this.markProcessingSuccess(
      transaction.id,
      providerTransactionId
    );
    if (!markedSuccess) {
      await this.routeUnclaimedOrderSuccess(transaction, providerTransactionId);
      return;
    }
    await this.runHandlerOrRestoreProcessing(transaction);
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
    const credited = await this.creditWalletIfNeeded(transaction);
    if (!credited) {
      await this.releaseProcessingClaimAfterCreditFailure(transaction.id);
      throw new Error(
        `Wallet credit failed for mobile payment ${transaction.id}; leaving pending for retry`
      );
    }
    const markedSuccess = await this.markProcessingSuccess(
      transaction.id,
      providerTransactionId
    );
    if (!markedSuccess) {
      await this.routeUnclaimedNonOrderSuccess(transaction);
      return;
    }
    await this.runHandlerOrRestoreProcessing(transaction);
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
   * Resume finalize when SUCCESS arrives on a processing row (crash recovery).
   * Skip the claim (already processing), then idempotently credit/debit → mark success → handler.
   * Note: resume skips assertProviderConfirmsCallback because a row only reaches processing
   * after a confirmed SUCCESS in the first finalize attempt.
   *
   * Staleness guard: only resume rows whose updated_at is older than ~60 seconds. A younger
   * processing row means another callback is mid-finalize; return without moving money so
   * only the first writer releases/withdraws/credits. Exception: FINALIZE_HANDLER_FAILED
   * means the first writer already finished and failed; the provider retry must resume
   * immediately (updated_at was just stamped, so the 60s skip would ACK 200 and drop retries).
   */
  private async resumeFinalizeFromProcessing(
    transaction: MobilePaymentTransaction,
    providerTransactionId: string
  ): Promise<void> {
    if (this.shouldSkipFreshProcessingResume(transaction)) {
      const ageMs = Date.now() - new Date(transaction.updated_at).getTime();
      this.logger.log(
        `Resume skipped for fresh processing tx ${transaction.id} (age ${Math.round(ageMs / 1000)}s < ${PROCESSING_RESUME_STALE_MS / 1000}s; another finalize is in flight)`
      );
      return;
    }
    const ageMs = Date.now() - new Date(transaction.updated_at).getTime();
    this.logger.log(
      `Resuming finalize for processing tx ${transaction.id} (crash recovery, age ${Math.round(ageMs / 1000)}s)`
    );
    
    // Branch on transaction type: GIVE_CHANGE needs debit, PAYMENT needs credit
    if (transaction.transaction_type === 'GIVE_CHANGE') {
      // GIVE_CHANGE: idempotent debit with momo-giveout:<tx id>
      const debited = await this.debitWalletIfNeeded(transaction);
      if (!debited) {
        // Provider payout already succeeded (processing is only reached after a
        // confirmed SUCCESS). Same outcome as finalizeGiveChangeSuccess and
        // PendingWithdrawalResolveService: success + WITHDRAWAL_FAILED for manual
        // reconciliation, never left in processing where finance can't see it.
        await this.databaseService.updateTransactionIfStatus(transaction.id, 'processing', {
          status: 'success',
          ...(providerTransactionId ? { transaction_id: providerTransactionId } : {}),
          error_message:
            'Provider payout succeeded but wallet debit failed; manual reconciliation required',
          error_code: 'WITHDRAWAL_FAILED',
        });
        this.logger.error(
          `GIVE_CHANGE ${transaction.id} provider success with ledger debit failure (resume)`
        );
        return;
      }
    } else {
      // PAYMENT: idempotent credit with momo-deposit:<tx id>
      const credited = await this.creditWalletIfNeeded(transaction);
      if (!credited) {
        // Credit failed; leave the row in processing (not pending) because
        // the wallet might have been credited before the crash.
        throw new Error(
          `Wallet credit failed while resuming ${transaction.id}; leaving processing for recovery`
        );
      }
    }
    
    // Mark processing → success. Clear the handler-failure marker so a paid row
    // does not keep FINALIZE_HANDLER_FAILED; a new handler failure sets it again.
    const markedSuccess = await this.databaseService.updateTransactionIfStatus(
      transaction.id,
      'processing',
      {
        status: 'success',
        ...(providerTransactionId ? { transaction_id: providerTransactionId } : {}),
        ...(String(transaction.error_code || '') === FINALIZE_HANDLER_FAILED
          ? { error_code: null }
          : {}),
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
    
    // GIVE_CHANGE has no entity handler. A PAYMENT handler failure must not
    // stay success: the next callback would take the swallowed replay path.
    if (transaction.transaction_type === 'PAYMENT') {
      await this.runHandlerOrRestoreProcessing(transaction);
    }
  }

  private async markProcessingSuccess(
    transactionId: string,
    providerTransactionId: string
  ): Promise<boolean> {
    return this.databaseService.updateTransactionIfStatus(
      transactionId,
      'processing',
      {
        status: 'success',
        ...(providerTransactionId ? { transaction_id: providerTransactionId } : {}),
      }
    );
  }

  private async releaseProcessingClaimAfterCreditFailure(
    transactionId: string
  ): Promise<void> {
    await this.databaseService
      .updateTransactionIfStatus(transactionId, 'processing', { status: 'pending' })
      .catch((e: any) =>
        this.logger.error(
          `Could not release processing claim after credit failure on ${transactionId}: ${e?.message ?? e}`
        )
      );
  }

  /**
   * The success mark is only the claim. If the entity handler throws, put the
   * row back to processing (not pending): pending can be failed or cancelled,
   * and success makes the next callback skip finalize. The provider retry then
   * resumes this path and keeps returning 5xx until the order is actually paid.
   *
   * Always re-throw handler failures as a generic error (5xx) so the provider keeps
   * retrying, even if the handler's original error was a 4xx. The money is claimed
   * and in the wallet; the order must be finalized on a later attempt.
   */
  private async runHandlerOrRestoreProcessing(
    transaction: MobilePaymentTransaction
  ): Promise<void> {
    try {
      await this.runHandlerSuccess(transaction);
    } catch (error: any) {
      await this.returnSuccessClaimToProcessing(transaction.id);
      this.logger.error(
        `Handler failed after success mark for ${transaction.id}: ${error?.message ?? error}`
      );
      // Always re-throw as a generic retryable error so providers keep retrying
      // (do not leak handler 4xx that would make the provider drop the callback)
      throw new Error(
        `Payment handler failed for ${transaction.payment_entity} ${transaction.entity_id}; will retry`
      );
    }
  }

  private shouldSkipFreshProcessingResume(
    transaction: MobilePaymentTransaction
  ): boolean {
    if (String(transaction.error_code || '') === FINALIZE_HANDLER_FAILED) {
      return false;
    }
    const ageMs = Date.now() - new Date(transaction.updated_at).getTime();
    return ageMs < PROCESSING_RESUME_STALE_MS;
  }

  private async returnSuccessClaimToProcessing(transactionId: string): Promise<void> {
    const released = await this.databaseService.updateTransactionIfStatus(
      transactionId,
      'success',
      { status: 'processing', error_code: FINALIZE_HANDLER_FAILED }
    );
    if (released) return;
    this.logger.error(
      `Could not return ${transactionId} to processing after handler failure`
    );
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
      idempotencyKey: `momo-giveout-release:${transaction.id}`,
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
      idempotencyKey: `momo-giveout-release:${transaction.id}`,
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
   * For `order_deposit`, and for `order` or `claim_order` on the first pass, it is
   * rethrown. The caller then moves success back to processing so the next SUCCESS
   * resumes finalize (5xx until the order is paid). A replay of a row that stayed
   * success only alerts (no endless 5xx).
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

  private async applyFedaPayFailureSideEffects(
    transaction: MobilePaymentTransaction,
    callbackData: FedaPayCallbackDto
  ): Promise<void> {
    if (callbackData.entity.status !== 'declined' && callbackData.entity.status !== 'canceled') {
      return;
    }
    const handlers = this.resolveHandlers();
    const handler = findPaymentCallbackHandler(
      handlers,
      transaction.payment_entity
    );
    if (handler) {
      const failureMessage = String(callbackData.entity.status || 'Payment declined');
      await handler.onPaymentFailure(transaction, failureMessage);
    }
  }
}

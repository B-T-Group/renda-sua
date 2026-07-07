import { Injectable, Logger } from '@nestjs/common';
import { ContextIdFactory } from '@nestjs/core';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { AccountsService } from '../accounts/accounts.service';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  findPaymentCallbackHandler,
  type PaymentCallbackHandler,
} from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import {
  StripePaymentsDatabaseService,
  type StripePaymentTransaction,
} from './stripe-payments-database.service';
import { StripeService } from './stripe.service';

@Injectable()
export class StripePaymentCallbackProcessor {
  private readonly logger = new Logger(StripePaymentCallbackProcessor.name);

  constructor(
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly accountsService: AccountsService,
    private readonly paymentCallbackRegistry: PaymentCallbackRegistryService,
    private readonly stripeService: StripeService,
    private readonly hasuraSystemService: HasuraSystemService
  ) {}

  private isManualCapture(tx: StripePaymentTransaction): boolean {
    return tx.capture_method === 'manual';
  }

  private async resolveHandlers(
    req: Request
  ): Promise<PaymentCallbackHandler[]> {
    const contextId = ContextIdFactory.getByRequest(req);
    return this.paymentCallbackRegistry.getHandlers(contextId);
  }

  private toCallbackTransaction(
    tx: StripePaymentTransaction
  ): MobilePaymentTransaction {
    const normalizedStatus =
      tx.status === 'authorized' || tx.status === 'capture_pending'
        ? 'pending'
        : tx.status === 'refunded' ||
            tx.status === 'disputed' ||
            tx.status === 'expired'
          ? 'failed'
          : tx.status;
    return {
      id: tx.id,
      reference: tx.reference,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description ?? '',
      provider: 'stripe',
      payment_method: 'card',
      status: normalizedStatus,
      transaction_id: tx.stripe_payment_intent_id,
      customer_email: tx.customer_email,
      account_id: tx.account_id,
      transaction_type: tx.transaction_type,
      payment_entity: tx.payment_entity,
      entity_id: tx.entity_id,
      created_at: tx.created_at,
      updated_at: tx.updated_at,
    };
  }

  async onCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
    req: Request
  ): Promise<void> {
    const reference = session.client_reference_id || undefined;
    const tx = reference
      ? await this.databaseService.getTransactionByReference(reference)
      : await this.databaseService.getTransactionBySessionId(session.id);
    if (!tx) {
      this.logger.warn(
        `Stripe checkout completed but no transaction for ${
          reference || session.id
        }`
      );
      return;
    }
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (tx.status !== 'pending' && tx.status !== 'authorized') {
      this.logger.log(
        `Stripe checkout skipped (already ${tx.status}): ${tx.id}`
      );
      return;
    }

    if (this.isManualCapture(tx)) {
      const pi = paymentIntentId
        ? await this.stripeService.retrievePaymentIntent(paymentIntentId)
        : null;
      if (pi?.status === 'requires_capture') {
        await this.applyAuthorized(tx, paymentIntentId, req);
      } else if (pi?.status === 'succeeded') {
        await this.applyCaptured(tx, paymentIntentId, req);
      }
      return;
    }

    if (session.payment_status !== 'paid') return;
    await this.applyCaptured(tx, paymentIntentId, req);
  }

  async onPaymentIntentAmountCapturableUpdated(
    paymentIntent: Stripe.PaymentIntent,
    req: Request
  ): Promise<void> {
    if (paymentIntent.status !== 'requires_capture') return;
    const tx = await this.resolveTransaction(paymentIntent);
    if (!tx || !this.isManualCapture(tx)) return;
    if (tx.status !== 'pending') return;
    await this.applyAuthorized(tx, paymentIntent.id, req);
  }

  async onPaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    req: Request
  ): Promise<void> {
    const tx = await this.resolveTransaction(paymentIntent);
    if (!tx) {
      this.logger.warn(
        `Stripe PaymentIntent succeeded but no transaction for ${paymentIntent.id}`
      );
      return;
    }
    if (tx.stripe_session_id && !this.isManualCapture(tx)) {
      return;
    }
    if (tx.status === 'success') {
      if (this.isManualCapture(tx)) {
        await this.retryManualCaptureSuccessSideEffects(tx, req);
        return;
      }
      this.logger.log(`Stripe PI skipped (already success): ${tx.id}`);
      return;
    }
    if (this.isManualCapture(tx)) {
      if (tx.status !== 'authorized' && tx.status !== 'capture_pending') {
        this.logger.log(
          `Manual capture PI succeeded but tx status is ${tx.status}: ${tx.id}`
        );
        return;
      }
    } else if (tx.status !== 'pending') {
      this.logger.log(
        `Stripe PaymentIntent skipped (already ${tx.status}): ${tx.id}`
      );
      return;
    }
    await this.applyCaptured(tx, paymentIntent.id, req);
  }

  private async retryManualCaptureSuccessSideEffects(
    tx: StripePaymentTransaction,
    req: Request
  ): Promise<void> {
    this.logger.log(`Retrying manual capture side effects for tx ${tx.id}`);
    const credited = await this.creditWalletIfNeeded(tx);
    if (credited) {
      await this.runHandlerSuccess(tx, req);
    }
  }

  async onPaymentIntentCanceled(
    paymentIntent: Stripe.PaymentIntent,
    req: Request
  ): Promise<void> {
    const tx = await this.resolveTransaction(paymentIntent);
    if (!tx) return;
    if (tx.status === 'cancelled' || tx.status === 'expired') {
      return;
    }
    if (!['pending', 'authorized', 'capture_pending'].includes(tx.status)) {
      return;
    }
    const isExpired = paymentIntent.cancellation_reason === 'automatic';
    await this.databaseService.updateTransaction(tx.id, {
      status: isExpired ? 'expired' : 'cancelled',
      stripe_payment_intent_id: paymentIntent.id,
      error_message: isExpired
        ? 'Payment authorization expired'
        : 'Payment authorization cancelled',
    });
    if (await this.shouldSkipCanceledIntentFailureHandler(tx)) {
      return;
    }
    await this.runHandlerFailure(
      tx,
      isExpired ? 'Payment authorization expired' : 'Payment authorization cancelled',
      req
    );
  }

  private async shouldSkipCanceledIntentFailureHandler(
    tx: StripePaymentTransaction
  ): Promise<boolean> {
    if (tx.payment_entity !== 'order') return false;
    const orderNumber = (tx.entity_id || tx.reference || '').trim();
    if (!orderNumber) return false;
    const query = `
      query OrderCancelState($orderNumber: String!) {
        orders(where: { order_number: { _eq: $orderNumber } }, limit: 1) {
          current_status
          payment_status
        }
      }
    `;
    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        orderNumber,
      });
      const row = response.orders?.[0];
      if (!row) return false;
      return (
        row.current_status === 'cancelled' || row.payment_status === 'cancelled'
      );
    } catch (error: any) {
      this.logger.warn(
        `Could not load order cancel state for ${orderNumber}: ${error?.message}`
      );
      return false;
    }
  }

  private async resolveTransaction(
    paymentIntent: Stripe.PaymentIntent
  ): Promise<StripePaymentTransaction | null> {
    const reference = paymentIntent.metadata?.reference;
    return reference
      ? await this.databaseService.getTransactionByReference(reference)
      : await this.databaseService.getTransactionByPaymentIntentId(
          paymentIntent.id
        );
  }

  private async applyAuthorized(
    tx: StripePaymentTransaction,
    paymentIntentId: string | undefined,
    req: Request
  ): Promise<void> {
    if (tx.payment_entity === 'order_cash_reconciliation') {
      return;
    }
    const authorizedAt = new Date().toISOString();
    await this.databaseService.updateTransaction(tx.id, {
      status: 'authorized',
      stripe_payment_intent_id: paymentIntentId,
      authorized_at: authorizedAt,
    });
    this.logger.log(
      `stripe_payment_authorized entity=${tx.payment_entity} ref=${tx.reference} tx=${tx.id}`
    );
    await this.runHandlerAuthorized(tx, req);
  }

  private async applyCaptured(
    tx: StripePaymentTransaction,
    paymentIntentId: string | undefined,
    req: Request
  ): Promise<void> {
    if (tx.payment_entity === 'order_cash_reconciliation') {
      await this.settleCashReconciliation(tx, paymentIntentId, req);
      return;
    }
    const capturedAt = new Date().toISOString();
    await this.databaseService.updateTransaction(tx.id, {
      status: 'success',
      stripe_payment_intent_id: paymentIntentId,
      captured_at: capturedAt,
    });
    const credited = await this.creditWalletIfNeeded(tx);
    if (credited) {
      await this.runHandlerSuccess(tx, req);
    }
  }

  private async creditWalletIfNeeded(
    tx: StripePaymentTransaction
  ): Promise<boolean> {
    if (!tx.account_id || tx.transaction_type !== 'PAYMENT') return true;
    const alreadyCredited =
      await this.accountsService.hasTransactionForReference({
        accountId: tx.account_id,
        transactionType: 'deposit',
        referenceId: tx.id,
      });
    if (alreadyCredited) return true;

    const result = await this.accountsService.registerTransaction({
      accountId: tx.account_id,
      amount: tx.amount,
      transactionType: 'deposit',
      memo: `Stripe payment deposit - ${tx.reference}`,
      referenceId: tx.id,
    });
    if (!result.success) {
      this.logger.error(
        `Failed to credit account ${tx.account_id}: ${result.error}`
      );
      return false;
    }
    this.logger.log(
      `Credited account ${tx.account_id} with ${tx.amount} ${tx.currency}`
    );
    return true;
  }

  private async runHandlerAuthorized(
    tx: StripePaymentTransaction,
    req: Request
  ): Promise<void> {
    try {
      const handlers = await this.resolveHandlers(req);
      const handler = findPaymentCallbackHandler(handlers, tx.payment_entity);
      if (handler?.onPaymentAuthorized) {
        await handler.onPaymentAuthorized(this.toCallbackTransaction(tx));
      }
    } catch (error: any) {
      this.logger.error(
        `Stripe authorization finalize failed for ${tx.id}: ${String(
          error?.message || error
        )}`
      );
    }
  }

  private async runHandlerSuccess(
    tx: StripePaymentTransaction,
    req: Request
  ): Promise<void> {
    try {
      const handlers = await this.resolveHandlers(req);
      const handler = findPaymentCallbackHandler(handlers, tx.payment_entity);
      if (handler) {
        await handler.onPaymentSuccess(this.toCallbackTransaction(tx));
      }
    } catch (error: any) {
      this.logger.error(
        `Stripe payment finalize failed for ${tx.id}: ${String(
          error?.message || error
        )}`
      );
    }
  }

  private async settleCashReconciliation(
    tx: StripePaymentTransaction,
    paymentIntentId: string | undefined,
    req: Request
  ): Promise<void> {
    const handlers = await this.resolveHandlers(req);
    const handler = findPaymentCallbackHandler(handlers, tx.payment_entity);
    if (!handler) {
      this.logger.warn(
        `No callback handler for cash reconciliation entity ${tx.payment_entity}`
      );
      return;
    }
    await handler.finalizeCashReconciliationAfterPayment(
      this.toCallbackTransaction(tx)
    );
    await this.databaseService.updateTransaction(tx.id, {
      status: 'success',
      stripe_payment_intent_id: paymentIntentId,
    });
    this.logger.log(`Cash reconciliation settled for stripe tx ${tx.id}`);
  }

  async onPaymentFailed(
    paymentIntent: Stripe.PaymentIntent,
    req: Request
  ): Promise<void> {
    const tx = await this.resolveTransaction(paymentIntent);
    if (!tx || !['pending', 'authorized', 'capture_pending'].includes(tx.status)) return;
    const message =
      paymentIntent.last_payment_error?.message || 'Payment failed';
    await this.databaseService.updateTransaction(tx.id, {
      status: 'failed',
      stripe_payment_intent_id: paymentIntent.id,
      error_message: message,
    });
    await this.runHandlerFailure(tx, message, req);
  }

  async onSessionExpired(
    session: Stripe.Checkout.Session,
    req: Request
  ): Promise<void> {
    const reference = session.client_reference_id || undefined;
    const tx = reference
      ? await this.databaseService.getTransactionByReference(reference)
      : await this.databaseService.getTransactionBySessionId(session.id);
    if (!tx || tx.status !== 'pending') return;
    await this.databaseService.updateTransaction(tx.id, {
      status: 'cancelled',
      error_message: 'Checkout session expired',
    });
    await this.runHandlerFailure(tx, 'Checkout session expired', req);
  }

  async onChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) return;
    const tx =
      await this.databaseService.getTransactionByPaymentIntentId(
        paymentIntentId
      );
    if (!tx || tx.status === 'refunded') return;

    const refundedMajor = Math.min((charge.amount_refunded ?? 0) / 100, tx.amount);

    if (charge.refunded && charge.refunds?.data && charge.refunds.data.length > 0) {
      const stripeRefundId = charge.refunds.data[0].id;
      const existingRefund = await this.databaseService.getRefundByStripeId(
        stripeRefundId
      );
      if (existingRefund && existingRefund.status === 'succeeded') {
        this.logger.log(
          `Refund ${stripeRefundId} already processed, skipping wallet reversal`
        );
        return;
      }
    }

    await this.reverseWalletForRefund(tx, refundedMajor);
    await this.databaseService.updateTransaction(tx.id, {
      status: 'refunded',
      error_message: `Refunded ${refundedMajor} ${tx.currency} via Stripe`,
    });
    this.logger.log(`Stripe refund recorded for tx ${tx.id}: ${refundedMajor}`);
  }

  private async reverseWalletForRefund(
    tx: StripePaymentTransaction,
    amount: number
  ): Promise<void> {
    if (!tx.account_id || tx.transaction_type !== 'PAYMENT' || amount <= 0) {
      return;
    }
    const result = await this.accountsService.registerTransaction({
      accountId: tx.account_id,
      amount,
      transactionType: 'withdrawal',
      memo: `Stripe refund reversal - ${tx.reference}`,
      referenceId: tx.id,
    });
    if (!result.success) {
      this.logger.error(
        `Failed to reverse wallet for refund ${tx.id}: ${result.error}`
      );
    }
  }

  async onDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    const paymentIntentId =
      typeof dispute.payment_intent === 'string'
        ? dispute.payment_intent
        : (dispute.payment_intent?.id ?? undefined);
    const tx = paymentIntentId
      ? await this.databaseService.getTransactionByPaymentIntentId(
          paymentIntentId
        )
      : null;
    if (!tx || tx.status === 'disputed' || tx.status === 'refunded') return;
    await this.databaseService.updateTransaction(tx.id, {
      status: 'disputed',
      error_message: `Dispute ${dispute.id} (${dispute.reason}) opened`,
    });
    this.logger.warn(
      `Stripe dispute opened for tx ${tx.id}: ${dispute.id} (${dispute.reason})`
    );
  }

  async onRefundCreated(refund: Stripe.Refund): Promise<void> {
    const paymentIntentId =
      typeof refund.payment_intent === 'string'
        ? refund.payment_intent
        : (refund.payment_intent?.id ?? undefined);

    if (!paymentIntentId || !refund.id) {
      this.logger.warn('Refund created event missing payment_intent or refund id');
      return;
    }

    const existingRefund = await this.databaseService.getRefundByStripeId(refund.id);
    if (existingRefund) {
      this.logger.log(`Refund ${refund.id} already recorded, skipping`);
      return;
    }

    const refundStatus = refund.status === 'succeeded' ? 'succeeded' : 'pending';
    await this.databaseService.updateRefundByStripeId(refund.id, {
      status: refundStatus,
    });

    this.logger.log(
      `Stripe refund created: ${refund.id}, status: ${refundStatus}`
    );
  }

  async onRefundUpdated(refund: Stripe.Refund): Promise<void> {
    const paymentIntentId =
      typeof refund.payment_intent === 'string'
        ? refund.payment_intent
        : (refund.payment_intent?.id ?? undefined);

    if (!paymentIntentId || !refund.id) {
      this.logger.warn('Refund updated event missing payment_intent or refund id');
      return;
    }

    const existingRefund = await this.databaseService.getRefundByStripeId(refund.id);
    if (!existingRefund) {
      this.logger.warn(`Refund ${refund.id} not found in database`);
      return;
    }

    const refundStatus = refund.status === 'succeeded' ? 'succeeded' : 'failed';
    const failureReason = refund.failure_reason || undefined;

    await this.databaseService.updateRefundByStripeId(refund.id, {
      status: refundStatus,
      failure_reason: failureReason,
    });

    if (refundStatus === 'succeeded') {
      const tx = await this.databaseService.getTransactionByPaymentIntentId(
        paymentIntentId
      );
      if (tx) {
        await this.reverseWalletForRefund(tx, existingRefund.amount);
        this.logger.log(
          `Wallet credited for refund ${refund.id}: ${existingRefund.amount} ${tx.currency}`
        );
      }
    } else if (refundStatus === 'failed') {
      this.logger.warn(
        `Stripe refund failed: ${refund.id}, reason: ${failureReason}`
      );
    }
  }

  private async runHandlerFailure(
    tx: StripePaymentTransaction,
    message: string,
    req: Request
  ): Promise<void> {
    try {
      const handlers = await this.resolveHandlers(req);
      const handler = findPaymentCallbackHandler(handlers, tx.payment_entity);
      if (handler) {
        await handler.onPaymentFailure(this.toCallbackTransaction(tx), message);
      }
    } catch (error: any) {
      this.logger.error(
        `Stripe failure side-effect failed for ${tx.id}: ${String(
          error?.message || error
        )}`
      );
    }
  }
}

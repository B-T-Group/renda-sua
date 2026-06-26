import { Injectable, Logger } from '@nestjs/common';
import { ContextIdFactory } from '@nestjs/core';
import type { Request } from 'express';
import type Stripe from 'stripe';
import { AccountsService } from '../accounts/accounts.service';
import type { MobilePaymentTransaction } from '../mobile-payments/mobile-payments-database.service';
import {
  findPaymentCallbackHandler,
  type PaymentCallbackHandler,
} from '../mobile-payments/payment-callback/payment-callback-handler.interface';
import { PaymentCallbackRegistryService } from '../mobile-payments/payment-callback/payment-callback-registry.service';
import {
  StripePaymentsDatabaseService,
  type StripePaymentTransaction,
} from './stripe-payments-database.service';

@Injectable()
export class StripePaymentCallbackProcessor {
  private readonly logger = new Logger(StripePaymentCallbackProcessor.name);

  constructor(
    private readonly databaseService: StripePaymentsDatabaseService,
    private readonly accountsService: AccountsService,
    private readonly paymentCallbackRegistry: PaymentCallbackRegistryService
  ) {}

  private async resolveHandlers(
    req: Request
  ): Promise<PaymentCallbackHandler[]> {
    const contextId = ContextIdFactory.getByRequest(req);
    return this.paymentCallbackRegistry.getHandlers(contextId);
  }

  /** Map a Stripe transaction onto the shared callback transaction shape. */
  private toCallbackTransaction(
    tx: StripePaymentTransaction
  ): MobilePaymentTransaction {
    return {
      id: tx.id,
      reference: tx.reference,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description ?? '',
      provider: 'stripe',
      payment_method: 'card',
      status:
        tx.status === 'refunded' || tx.status === 'disputed'
          ? 'failed'
          : tx.status,
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
    if (tx.status !== 'pending') {
      this.logger.log(
        `Stripe checkout skipped (already ${tx.status}): ${tx.id}`
      );
      return;
    }
    if (session.payment_status !== 'paid') {
      return;
    }
    await this.applySuccess(tx, paymentIntentId, req);
  }

  /**
   * Finalize a payment collected directly via a PaymentIntent (e.g. the mobile
   * PaymentSheet). Transactions backed by a hosted Checkout session are skipped
   * here and finalized by `onCheckoutSessionCompleted` instead, so the wallet is
   * never credited twice for the same order.
   */
  async onPaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
    req: Request
  ): Promise<void> {
    const reference = paymentIntent.metadata?.reference;
    const tx = reference
      ? await this.databaseService.getTransactionByReference(reference)
      : await this.databaseService.getTransactionByPaymentIntentId(
          paymentIntent.id
        );
    if (!tx) {
      this.logger.warn(
        `Stripe PaymentIntent succeeded but no transaction for ${
          reference || paymentIntent.id
        }`
      );
      return;
    }
    if (tx.stripe_session_id) {
      // Settled through the hosted Checkout flow; let the session handler win.
      return;
    }
    if (tx.status !== 'pending') {
      this.logger.log(
        `Stripe PaymentIntent skipped (already ${tx.status}): ${tx.id}`
      );
      return;
    }
    await this.applySuccess(tx, paymentIntent.id, req);
  }

  private async applySuccess(
    tx: StripePaymentTransaction,
    paymentIntentId: string | undefined,
    req: Request
  ): Promise<void> {
    if (tx.payment_entity === 'order_cash_reconciliation') {
      await this.settleCashReconciliation(tx, paymentIntentId, req);
      return;
    }
    await this.databaseService.updateTransaction(tx.id, {
      status: 'success',
      stripe_payment_intent_id: paymentIntentId,
    });
    await this.creditWalletIfNeeded(tx);
    await this.runHandlerSuccess(tx, req);
  }

  private async creditWalletIfNeeded(
    tx: StripePaymentTransaction
  ): Promise<void> {
    if (!tx.account_id || tx.transaction_type !== 'PAYMENT') return;
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
      return;
    }
    this.logger.log(
      `Credited account ${tx.account_id} with ${tx.amount} ${tx.currency}`
    );
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
    const reference = paymentIntent.metadata?.reference;
    const tx = reference
      ? await this.databaseService.getTransactionByReference(reference)
      : await this.databaseService.getTransactionByPaymentIntentId(
          paymentIntent.id
        );
    if (!tx || tx.status !== 'pending') return;
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

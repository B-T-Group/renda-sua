import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { StripeService } from '../stripe-payments/stripe.service';
import {
  OrderTaxSnapshotRepository,
  type OrderTaxContext,
} from './order-tax-snapshot.repository';
import {
  buildSnapshotFromCalculation,
  planTaxReversal,
} from './order-tax-snapshot.util';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';

/** The slice of a Stripe PaymentIntent the tax lifecycle needs. */
export interface CapturedPaymentIntentLike {
  id?: string;
  amount_received?: number | null;
  metadata?: Record<string, string> | null;
}

/**
 * Order tax lifecycle around the manual-capture / refund / cancel flows.
 *
 * Every public method is best-effort: it logs and swallows its own errors so a tax
 * bookkeeping problem can never fail a capture, a cancellation or a refund. It never
 * writes orders.total_amount / tax_amount / pre_tax_total (see OrderTaxSnapshotRepository),
 * so payouts, refunds and the cancellation-fee base are unaffected.
 */
@Injectable()
export class OrderTaxLifecycleService {
  private readonly logger = new Logger(OrderTaxLifecycleService.name);

  constructor(
    private readonly repo: OrderTaxSnapshotRepository,
    private readonly stripeService: StripeService,
    private readonly taxBuilder: StripeTaxCheckoutBuilderService
  ) {}

  /** Persist the checkout-time calculation (status `estimated`). */
  async recordEstimate(params: {
    orderId: string;
    currency: string;
    calculation: Stripe.Tax.Calculation;
  }): Promise<void> {
    try {
      const input = buildSnapshotFromCalculation(
        params.calculation,
        params.currency,
        (minor, cur) => this.taxBuilder.fromMinorUnits(minor, cur)
      );
      if (!input.stripe_tax_calculation_id) return;
      await this.repo.upsertEstimate(params.orderId, input);
    } catch (error: any) {
      this.logger.error(
        `order_tax_snapshot_record_failed orderId=${params.orderId}: ${error?.message}`
      );
    }
  }

  /**
   * Called after our own capture (and again from the payment_intent.succeeded webhook,
   * which finds the transaction already `success`). Idempotent: once the snapshot is
   * finalized, or the order is void/none/finalized, it is a no-op.
   *
   * Finalizes tax_status, ids and breakdown only; totals stay as they are.
   */
  async finalizeAfterCapture(params: {
    orderNumber: string;
    paymentIntent?: CapturedPaymentIntentLike | null;
  }): Promise<void> {
    const { orderNumber } = params;
    try {
      const ctx = await this.repo.getContextByOrderNumber(orderNumber);
      if (!ctx || ctx.order.tax_status !== 'estimated') return;

      const pi = await this.resolvePaymentIntent(params.paymentIntent);
      const piCalcId = pi?.metadata?.stripe_tax_calculation_id?.trim() || null;
      const calcId = piCalcId ?? ctx.snapshot?.stripe_tax_calculation_id ?? null;
      if (!calcId) return;
      if (ctx.snapshot && ctx.snapshot.status !== 'estimated') return;

      const calculation = await this.ensureSnapshot(ctx, calcId);
      const taxTransactionId =
        ctx.snapshot?.stripe_tax_calculation_id === calcId
          ? ctx.snapshot.stripe_tax_transaction_id
          : null;
      const txId =
        taxTransactionId ??
        (await this.createTaxTransaction(calcId, orderNumber));
      if (!txId) {
        this.logger.warn(
          `order_tax_finalize_deferred order=${orderNumber}: no Stripe tax transaction yet`
        );
        return;
      }
      await this.repo.markFinalized({
        orderId: ctx.order.id,
        calculationId: calcId,
        taxTransactionId: txId,
        capturedTotalIncludingTax:
          pi?.amount_received != null
            ? this.taxBuilder.fromMinorUnits(
                pi.amount_received,
                ctx.order.currency
              )
            : null,
        taxBreakdown: calculation.tax_breakdown ?? null,
        taxJurisdiction: this.jurisdictionOf(calculation),
      });
      this.logger.log(
        `order_tax_finalized order=${orderNumber} calc=${calcId} txn=${txId}`
      );
    } catch (error: any) {
      this.logger.error(
        `order_tax_finalize_failed order=${orderNumber}: ${error?.message}`
      );
    }
  }

  /**
   * The legacy webhook finalizer (auto-capture) already wrote the order and created the
   * Stripe tax transaction; mirror that into the snapshot so refunds can be reversed.
   */
  async syncLegacyFinalized(params: {
    orderNumber: string;
    calculation: Stripe.Tax.Calculation;
    taxTransactionId?: string | null;
  }): Promise<void> {
    const { orderNumber, calculation } = params;
    try {
      const ctx = await this.repo.getContextByOrderNumber(orderNumber);
      if (!ctx || !calculation.id) return;
      if (ctx.snapshot && ctx.snapshot.status === 'void') return;
      if (ctx.snapshot && ctx.snapshot.status === 'finalized') return;
      await this.recordEstimate({
        orderId: ctx.order.id,
        currency: ctx.order.currency,
        calculation,
      });
      // Only rows still `estimated` move; the order row was finalized by the legacy writer.
      await this.repo.markFinalized({
        orderId: ctx.order.id,
        calculationId: calculation.id,
        taxTransactionId:
          params.taxTransactionId ??
          ctx.snapshot?.stripe_tax_transaction_id ??
          null,
        capturedTotalIncludingTax: null,
        taxBreakdown: calculation.tax_breakdown ?? null,
        taxJurisdiction: this.jurisdictionOf(calculation),
      });
    } catch (error: any) {
      this.logger.error(
        `order_tax_legacy_sync_failed order=${orderNumber}: ${error?.message}`
      );
    }
  }

  /** Cancelled / expired / never captured: `estimated` becomes `void`. */
  async voidForOrder(orderNumber: string): Promise<void> {
    try {
      const ctx = await this.repo.getContextByOrderNumber(orderNumber);
      if (!ctx || ctx.order.tax_status !== 'estimated') return;
      await this.repo.markVoid(ctx.order.id);
      this.logger.log(`order_tax_void order=${orderNumber}`);
    } catch (error: any) {
      this.logger.error(
        `order_tax_void_failed order=${orderNumber}: ${error?.message}`
      );
    }
  }

  /**
   * Reverse the tax of a refund in Stripe Tax (partial, or full when the refund covers the
   * whole tax transaction). Idempotent per Stripe refund: a ledger row keyed on the refund
   * id plus a Stripe idempotency key and unique reversal reference.
   */
  async reverseForRefund(params: {
    orderNumber: string;
    stripeRefundId: string;
    refundAmountMinor: number;
  }): Promise<void> {
    const { orderNumber, stripeRefundId, refundAmountMinor } = params;
    try {
      const ctx = await this.repo.getContextByOrderNumber(orderNumber);
      const snapshot = ctx?.snapshot;
      if (!ctx || !snapshot) return;
      if (snapshot.status !== 'finalized' || !snapshot.stripe_tax_transaction_id) {
        return;
      }
      const currency = snapshot.currency;
      const state = await this.repo.getReversalState(snapshot.id, stripeRefundId);
      if (state.alreadyReversed) return;

      const plan = planTaxReversal({
        totalMinor: this.taxBuilder.toMinorUnits(
          snapshot.total_including_tax,
          currency
        ),
        reversedMinor: state.reversedMinor,
        refundMinor: refundAmountMinor,
      });
      if (!plan) return;

      const reference = `${orderNumber}_${stripeRefundId}`;
      const reversal = await this.stripeService.createTaxReversal({
        originalTransactionId: snapshot.stripe_tax_transaction_id,
        mode: plan.mode,
        flatAmountMinor: plan.amountMinor,
        reference,
        idempotencyKey: `tax_reversal_${stripeRefundId}`,
        metadata: { orderNumber, stripeRefundId },
      });
      await this.repo.insertReversal({
        snapshotId: snapshot.id,
        orderId: ctx.order.id,
        stripeRefundId,
        stripeTaxReversalId: reversal.id ?? null,
        reference,
        mode: plan.mode,
        amountMinor: plan.amountMinor,
        currency,
      });
      this.logger.log(
        `order_tax_reversed order=${orderNumber} refund=${stripeRefundId} mode=${plan.mode} amount_minor=${plan.amountMinor}`
      );
    } catch (error: any) {
      this.logger.error(
        `order_tax_reversal_failed order=${orderNumber} refund=${stripeRefundId}: ${error?.message}`
      );
    }
  }

  private async resolvePaymentIntent(
    pi?: CapturedPaymentIntentLike | null
  ): Promise<CapturedPaymentIntentLike | null> {
    if (!pi) return null;
    if (pi.metadata || !pi.id) return pi;
    try {
      return await this.stripeService.retrievePaymentIntent(pi.id);
    } catch {
      return pi;
    }
  }

  /** Make sure the snapshot row matches calcId (create or refresh it) and return the calc. */
  private async ensureSnapshot(
    ctx: OrderTaxContext,
    calcId: string
  ): Promise<Stripe.Tax.Calculation> {
    const calculation = await this.stripeService.retrieveTaxCalculation(calcId);
    if (ctx.snapshot?.stripe_tax_calculation_id !== calcId) {
      await this.recordEstimate({
        orderId: ctx.order.id,
        currency: ctx.order.currency,
        calculation,
      });
    }
    return calculation;
  }

  private async createTaxTransaction(
    calcId: string,
    orderNumber: string
  ): Promise<string | null> {
    try {
      const tx = await this.stripeService.createTaxTransactionFromCalculation(
        calcId,
        orderNumber,
        `tax_txn_${orderNumber}`
      );
      return tx.id ?? null;
    } catch (error: any) {
      this.logger.warn(
        `order_tax_transaction_failed order=${orderNumber}: ${error?.message}`
      );
      return null;
    }
  }

  private jurisdictionOf(calculation: Stripe.Tax.Calculation) {
    const addr = calculation.customer_details?.address;
    return addr
      ? {
          country: addr.country ?? '',
          state: addr.state ?? '',
          postal_code: addr.postal_code ?? '',
          city: addr.city ?? '',
        }
      : null;
  }
}

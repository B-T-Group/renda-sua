import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { StripePaymentsDatabaseService } from '../stripe-payments/stripe-payments-database.service';
import { StripeService } from '../stripe-payments/stripe.service';
import {
  OrderTaxSnapshotRepository,
  type OrderTaxContext,
} from './order-tax-snapshot.repository';
import {
  buildSnapshotFromCalculation,
  normalizeCalculationBreakdown,
  planTaxReversal,
} from './order-tax-snapshot.util';
import { StripeTaxCheckoutBuilderService } from './stripe-tax-checkout-builder.service';

/** The slice of a Stripe PaymentIntent the tax lifecycle needs. */
export interface CapturedPaymentIntentLike {
  id?: string;
  status?: string;
  amount_received?: number | null;
  metadata?: Record<string, string> | null;
}

/**
 * - finalized: snapshot + order moved to `finalized` now.
 * - healed: snapshot was already `finalized`; missing transaction id / captured total filled.
 * - already_finalized: nothing to do.
 * - skipped: not a snapshot order (no tax, hosted Checkout, no calculation, PI not captured).
 * - deferred: could not finish (Stripe/DB error or no Stripe tax transaction yet). Retriable:
 *   the reconciler, the admin endpoint and the next refund re-run it.
 */
export type TaxFinalizeOutcome =
  | 'finalized'
  | 'healed'
  | 'already_finalized'
  | 'skipped'
  | 'deferred';

export type TaxReversalOutcome =
  | 'reversed'
  | 'already_reversed'
  | 'skipped'
  | 'failed';

export interface TaxReconcileItem {
  orderNumber: string;
  finalize: TaxFinalizeOutcome | 'not_needed' | 'would_finalize';
  reversals: number;
  detail?: string;
}

/** Upper bound for the Stripe/DB work one lifecycle call may do inline. */
export const ORDER_TAX_STEP_DEADLINE_MS = 12_000;

/**
 * Order tax lifecycle around the manual-capture / refund / cancel flows.
 *
 * Every public method is best-effort for its caller: it logs, bounds itself with a deadline
 * and swallows its own errors (returning `deferred` / `failed`) so a tax bookkeeping problem
 * can never fail a capture, a cancellation or a refund. The one exception is
 * {@link resolveRefundTaxMode}, which throws when the tax state cannot be read so a refund
 * fails closed rather than silently dropping the tax portion. An unfinalized snapshot is
 * still tax-inclusive: card math uses the PaymentIntent charge, and Stripe Tax bookkeeping
 * stays deferred for the reconciler. It never writes orders.total_amount / tax_amount /
 * pre_tax_total (see OrderTaxSnapshotRepository): payouts, wallet credits and the
 * cancellation-fee base are unaffected.
 */
@Injectable()
export class OrderTaxLifecycleService {
  private readonly logger = new Logger(OrderTaxLifecycleService.name);

  constructor(
    private readonly repo: OrderTaxSnapshotRepository,
    private readonly stripeService: StripeService,
    private readonly taxBuilder: StripeTaxCheckoutBuilderService,
    private readonly paymentsDb: StripePaymentsDatabaseService
  ) {}

  /** Persist the checkout-time calculation (status `estimated`). */
  async recordEstimate(params: {
    orderId: string;
    currency: string;
    calculation: Stripe.Tax.Calculation;
  }): Promise<void> {
    try {
      await this.withDeadline(`record_estimate ${params.orderId}`, () =>
        this.writeEstimate(params.orderId, params.currency, params.calculation)
      );
    } catch (error: any) {
      // Not fatal: finalizeAfterCapture re-creates the snapshot from the PaymentIntent's
      // calculation id, and the reconciler lists orders that never got one.
      this.logger.error(
        `order_tax_snapshot_record_failed orderId=${params.orderId}: ${error?.message}`
      );
    }
  }

  /**
   * THE finalizer for Stripe-Tax-calculation orders (manual capture, PaymentSheet and the
   * auto-capture webhook all call it). Idempotent and self-healing:
   *
   * - snapshot missing / stale / void / estimated  -> (re)written, then finalized together with
   *   the order in ONE transaction, so an order can never be `finalized` without a snapshot;
   * - already `finalized` but missing the Stripe tax transaction id or the captured total
   *   -> only those NULL columns are filled;
   * - no Stripe tax transaction obtainable -> NOT finalized (`deferred`): a snapshot without a
   *   transaction id could never be reversed, so it stays `estimated` for the reconciler.
   *
   * `void` is not terminal: a capture that really happened outranks an earlier cancel/expiry.
   * Totals on the order are never rewritten (see class comment).
   */
  async finalizeAfterCapture(params: {
    orderNumber: string;
    paymentIntent?: CapturedPaymentIntentLike | null;
  }): Promise<TaxFinalizeOutcome> {
    const { orderNumber } = params;
    try {
      return await this.withDeadline(`finalize ${orderNumber}`, () =>
        this.finalizeInner(params)
      );
    } catch (error: any) {
      this.logger.error(
        `order_tax_finalize_failed order=${orderNumber}: ${error?.message}`
      );
      return 'deferred';
    }
  }

  private async finalizeInner(params: {
    orderNumber: string;
    paymentIntent?: CapturedPaymentIntentLike | null;
  }): Promise<TaxFinalizeOutcome> {
    const { orderNumber } = params;
    const ctx = await this.repo.getContextByOrderNumber(orderNumber);
    if (!ctx || ctx.order.tax_status === 'none') return 'skipped';
    const { order } = ctx;
    const snapshot = ctx.snapshot;

    if (!params.paymentIntent) return 'skipped';
    const pi = await this.resolvePaymentIntent(params.paymentIntent);
    if (!pi || (pi.status != null && pi.status !== 'succeeded')) return 'skipped';
    const capturedMinor = pi.amount_received ?? null;

    if (
      snapshot?.status === 'finalized' &&
      snapshot.stripe_tax_transaction_id &&
      order.tax_status === 'finalized' &&
      (snapshot.captured_total_including_tax != null || capturedMinor == null)
    ) {
      return 'already_finalized';
    }

    const piCalcId = pi.metadata?.stripe_tax_calculation_id?.trim() || null;
    const calcId =
      snapshot?.status === 'finalized'
        ? snapshot.stripe_tax_calculation_id
        : (piCalcId ?? snapshot?.stripe_tax_calculation_id ?? null);
    if (!calcId) return 'skipped';

    let calculation: Stripe.Tax.Calculation | null = null;
    if (!snapshot || (snapshot.status !== 'finalized' && snapshot.stripe_tax_calculation_id !== calcId)) {
      calculation = await this.stripeService.retrieveTaxCalculation(calcId);
      await this.writeEstimate(order.id, order.currency, calculation);
    }

    const knownTxn =
      snapshot && snapshot.stripe_tax_calculation_id === calcId
        ? snapshot.stripe_tax_transaction_id
        : null;
    const txnId = knownTxn ?? (await this.createTaxTransaction(calcId, orderNumber));
    if (!txnId) {
      this.logger.warn(
        `order_tax_finalize_deferred order=${orderNumber} calc=${calcId}: no Stripe tax transaction (needs reconcile)`
      );
      return 'deferred';
    }
    const captured =
      capturedMinor != null
        ? this.taxBuilder.fromMinorUnits(capturedMinor, order.currency)
        : null;

    if (snapshot?.status === 'finalized') {
      const { filled } = await this.repo.fillFinalizedGaps({
        orderId: order.id,
        taxTransactionId: txnId,
        capturedTotalIncludingTax: captured,
      });
      this.logger.log(
        `order_tax_healed order=${orderNumber} calc=${calcId} txn=${txnId} filled=${filled}`
      );
      return 'healed';
    }

    calculation ??= await this.stripeService.retrieveTaxCalculation(calcId);
    const result = await this.repo.markFinalized({
      orderId: order.id,
      calculationId: calcId,
      taxTransactionId: txnId,
      capturedTotalIncludingTax: captured,
      taxBreakdown: normalizeCalculationBreakdown(calculation),
      taxJurisdiction: this.jurisdictionOf(calculation),
    });
    if (result.snapshotsUpdated === 0) {
      // Lost a race with a concurrent finalizer (or the snapshot was finalized between our
      // read and write). Make sure its NULL columns are filled, then report it as done.
      await this.repo.fillFinalizedGaps({
        orderId: order.id,
        taxTransactionId: txnId,
        capturedTotalIncludingTax: captured,
      });
      return 'already_finalized';
    }
    this.logger.log(
      `order_tax_finalized order=${orderNumber} calc=${calcId} txn=${txnId}`
    );
    return 'finalized';
  }

  /** Cancelled / expired / never captured: `estimated` becomes `void` (re-openable). */
  async voidForOrder(orderNumber: string): Promise<void> {
    try {
      await this.withDeadline(`void ${orderNumber}`, async () => {
        const ctx = await this.repo.getContextByOrderNumber(orderNumber);
        if (!ctx || ctx.order.tax_status !== 'estimated') return;
        await this.repo.markVoid(ctx.order.id);
        this.logger.log(`order_tax_void order=${orderNumber}`);
      });
    } catch (error: any) {
      this.logger.error(
        `order_tax_void_failed order=${orderNumber}: ${error?.message}`
      );
    }
  }

  /**
   * Does this order refund tax-inclusively? True for calculation-based orders (estimated /
   * void / snapshot present / PaymentIntent calculation id), after a heal attempt when the
   * snapshot is not yet `finalized`. Card refunds use PaymentIntent `amount_received` and
   * do not wait on Stripe Tax. Legacy and hosted-Checkout orders return false.
   *
   * THROWS when the tax state cannot be read: the caller must fail the refund (it is
   * idempotent and retriable) instead of refunding pre-tax and silently keeping the tax.
   */
  async resolveRefundTaxMode(
    orderNumber: string,
    paymentIntent: CapturedPaymentIntentLike
  ): Promise<boolean> {
    let ctx = await this.repo.getContextByOrderNumber(orderNumber);
    if (!this.isTaxCalculationOrder(ctx, paymentIntent)) return false;
    if (ctx?.snapshot?.status === 'finalized') return true;
    const outcome = await this.finalizeAfterCapture({
      orderNumber,
      paymentIntent,
    });
    ctx = await this.repo.getContextByOrderNumber(orderNumber);
    if (ctx?.snapshot?.status === 'finalized') return true;
    this.logger.warn(
      `order_tax_refund_unfinalized order=${orderNumber} outcome=${outcome}: refunding tax-inclusive from the charge; Stripe Tax stays deferred`
    );
    return this.isTaxCalculationOrder(ctx, paymentIntent);
  }

  /** Calculation-based tax (PaymentSheet) vs legacy / hosted Checkout (ledger already includes tax). */
  private isTaxCalculationOrder(
    ctx: OrderTaxContext | null,
    paymentIntent: CapturedPaymentIntentLike
  ): boolean {
    if (!ctx || ctx.order.tax_status === 'none') return false;
    if (ctx.order.tax_status === 'estimated' || ctx.order.tax_status === 'void') {
      return true;
    }
    if (ctx.snapshot) return true;
    return !!paymentIntent.metadata?.stripe_tax_calculation_id?.trim();
  }

  /**
   * Reverse the tax of a refund in Stripe Tax (partial, or full when the refund covers the
   * whole tax transaction). `refundAmountMinor` is the money that went back to the card
   * (ledger part + tax part). Idempotent per Stripe refund: a ledger row keyed on the refund
   * id, a unique reversal reference and a Stripe idempotency key.
   */
  async reverseForRefund(params: {
    orderNumber: string;
    stripeRefundId: string;
    refundAmountMinor: number;
  }): Promise<TaxReversalOutcome> {
    const { orderNumber, stripeRefundId } = params;
    try {
      return await this.withDeadline(`reverse ${orderNumber}`, () =>
        this.reverseInner(params)
      );
    } catch (error: any) {
      this.logger.error(
        `order_tax_reversal_failed order=${orderNumber} refund=${stripeRefundId}: ${error?.message}`
      );
      return 'failed';
    }
  }

  private async reverseInner(params: {
    orderNumber: string;
    stripeRefundId: string;
    refundAmountMinor: number;
  }): Promise<TaxReversalOutcome> {
    const { orderNumber, stripeRefundId, refundAmountMinor } = params;
    const ctx = await this.repo.getContextByOrderNumber(orderNumber);
    const snapshot = ctx?.snapshot;
    if (!ctx || !snapshot || snapshot.status !== 'finalized') return 'skipped';
    if (!snapshot.stripe_tax_transaction_id) {
      this.logger.warn(
        `order_tax_reversal_blocked order=${orderNumber} refund=${stripeRefundId}: snapshot has no Stripe tax transaction id (reconcile will retry)`
      );
      return 'skipped';
    }
    const currency = snapshot.currency;
    const state = await this.repo.getReversalState(snapshot.id, stripeRefundId);
    if (state.alreadyReversed) return 'already_reversed';

    const plan = planTaxReversal({
      totalMinor: this.taxBuilder.toMinorUnits(
        snapshot.total_including_tax,
        currency
      ),
      reversedMinor: state.reversedMinor,
      refundMinor: refundAmountMinor,
    });
    if (!plan) return 'skipped';

    const reference = `${orderNumber}_${stripeRefundId}`;
    const reversal = await this.stripeService.createTaxReversal({
      originalTransactionId: snapshot.stripe_tax_transaction_id,
      mode: plan.mode,
      flatAmountMinor: plan.amountMinor,
      reference,
      // The amount is part of the key: a retry with a different amount (e.g. a catch-up)
      // is a new request, not a Stripe idempotency-conflict error.
      idempotencyKey: `tax_reversal_${stripeRefundId}_${plan.amountMinor}`,
      metadata: { orderNumber, stripeRefundId },
    });
    try {
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
    } catch (error: any) {
      // The reversal exists in Stripe but our ledger row is missing. Say so loudly: a retry
      // within Stripe's idempotency window re-reads the same reversal and records it.
      this.logger.error(
        `order_tax_reversal_unrecorded order=${orderNumber} refund=${stripeRefundId} reversal=${reversal.id}: ${error?.message}`
      );
      throw error;
    }
    this.logger.log(
      `order_tax_reversed order=${orderNumber} refund=${stripeRefundId} mode=${plan.mode} amount_minor=${plan.amountMinor}`
    );
    return 'reversed';
  }

  /**
   * Reconcile one order: finalize (or heal) its snapshot when the payment is captured, then
   * reverse the tax of every succeeded refund that has no reversal row. `dryRun` only reads.
   */
  async reconcileOrder(
    orderNumber: string,
    opts: { dryRun: boolean }
  ): Promise<TaxReconcileItem> {
    const item: TaxReconcileItem = {
      orderNumber,
      finalize: 'not_needed',
      reversals: 0,
    };
    try {
      const ctx = await this.repo.getContextByOrderNumber(orderNumber);
      if (!ctx || ctx.order.tax_status === 'none') {
        item.detail = 'no tax state';
        return item;
      }
      const tx = await this.paymentsDb.getTransactionByEntityId(orderNumber);
      const captured =
        tx?.status === 'success' || tx?.status === 'refunded';
      const snap = ctx.snapshot;
      const needsFinalize =
        captured &&
        tx?.stripe_payment_intent_id &&
        (ctx.order.tax_status !== 'finalized' ||
          !snap ||
          snap.status !== 'finalized' ||
          !snap.stripe_tax_transaction_id ||
          snap.captured_total_including_tax == null);
      if (needsFinalize && tx?.stripe_payment_intent_id) {
        if (opts.dryRun) {
          item.finalize = 'would_finalize';
        } else {
          const pi = await this.stripeService.retrievePaymentIntent(
            tx.stripe_payment_intent_id
          );
          item.finalize = await this.finalizeAfterCapture({
            orderNumber,
            paymentIntent: pi,
          });
        }
      }
      item.reversals = await this.catchUpReversals(orderNumber, opts.dryRun);
      if (needsFinalize && item.finalize === 'deferred') {
        this.logger.warn(`order_tax_reconcile_unresolved order=${orderNumber}`);
      }
    } catch (error: any) {
      item.detail = error?.message ?? String(error);
      this.logger.error(
        `order_tax_reconcile_failed order=${orderNumber}: ${item.detail}`
      );
    }
    return item;
  }

  /** Orders that look unfinished (see repository.listReconcileCandidates), then reconcile each. */
  async reconcileBatch(opts: {
    dryRun: boolean;
    limit: number;
    olderThanMinutes?: number;
  }): Promise<{ scanned: number; items: TaxReconcileItem[] }> {
    const numbers = await this.repo.listReconcileCandidates(
      opts.limit,
      opts.olderThanMinutes ?? 15
    );
    const items: TaxReconcileItem[] = [];
    for (const orderNumber of numbers) {
      items.push(await this.reconcileOrder(orderNumber, { dryRun: opts.dryRun }));
    }
    const count = (f: (i: TaxReconcileItem) => boolean) => items.filter(f).length;
    this.logger.log(
      `order_tax_reconcile_summary dryRun=${opts.dryRun} scanned=${numbers.length} finalized=${count(
        (i) => i.finalize === 'finalized' || i.finalize === 'healed'
      )} would_finalize=${count((i) => i.finalize === 'would_finalize')} deferred=${count(
        (i) => i.finalize === 'deferred'
      )} reversals=${items.reduce((n, i) => n + i.reversals, 0)} errors=${count(
        (i) => !!i.detail
      )}`
    );
    return { scanned: numbers.length, items };
  }

  /** Succeeded refunds of a finalized snapshot order that have no reversal row yet. */
  private async catchUpReversals(
    orderNumber: string,
    dryRun: boolean
  ): Promise<number> {
    const ctx = await this.repo.getContextByOrderNumber(orderNumber);
    const snapshot = ctx?.snapshot;
    if (!ctx || !snapshot || snapshot.status !== 'finalized') return 0;
    if (!snapshot.stripe_tax_transaction_id) return 0;
    const refunds = await this.paymentsDb.listRefundsForOrder(ctx.order.id);
    const state = await this.repo.getReversalState(snapshot.id, '');
    let done = 0;
    for (const r of refunds) {
      if (r.status !== 'succeeded' || !r.stripe_refund_id) continue;
      if (state.refundIds.includes(r.stripe_refund_id)) continue;
      const minor = this.taxBuilder.toMinorUnits(
        Number(r.amount) + Number(r.tax_refund_amount ?? 0),
        snapshot.currency
      );
      if (dryRun) {
        done += 1;
        continue;
      }
      const outcome = await this.reverseForRefund({
        orderNumber,
        stripeRefundId: r.stripe_refund_id,
        refundAmountMinor: minor,
      });
      if (outcome === 'reversed') done += 1;
    }
    return done;
  }

  private async resolvePaymentIntent(
    pi: CapturedPaymentIntentLike
  ): Promise<CapturedPaymentIntentLike | null> {
    if ((pi.metadata && pi.status) || !pi.id) return pi;
    try {
      return await this.stripeService.retrievePaymentIntent(pi.id);
    } catch {
      return pi;
    }
  }

  /** Create or refresh the snapshot row for this calculation. Throws on failure. */
  private async writeEstimate(
    orderId: string,
    currency: string,
    calculation: Stripe.Tax.Calculation
  ): Promise<void> {
    const input = buildSnapshotFromCalculation(calculation, currency, (m, c) =>
      this.taxBuilder.fromMinorUnits(m, c)
    );
    if (!input.stripe_tax_calculation_id) return;
    await this.repo.upsertEstimate(orderId, input);
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
      // Inside Stripe's idempotency window a retry returns the same transaction. Past it,
      // Stripe refuses to reuse the calculation: that needs a human (see the PR notes).
      this.logger.warn(
        `order_tax_transaction_failed order=${orderNumber} calc=${calcId}: ${error?.message}`
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

  /** Bound inline tax work; the work itself is idempotent, so a late finish is harmless. */
  private async withDeadline<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(`order tax step timed out after ${ORDER_TAX_STEP_DEADLINE_MS}ms (${label})`)
          ),
        ORDER_TAX_STEP_DEADLINE_MS
      );
    });
    try {
      return await Promise.race([fn(), deadline]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export type { OrderTaxContext };

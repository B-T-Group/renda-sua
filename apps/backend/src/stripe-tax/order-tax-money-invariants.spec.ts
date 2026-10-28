/**
 * Proof that the tax snapshot lifecycle does not change money semantics.
 *
 * The real repository + lifecycle service run against an in-memory Hasura that interprets the
 * actual GraphQL documents they send (`_set` blocks, `where` guards, on_conflict). The order row
 * carries every money column payouts / refunds / the cancellation-fee base read. After
 * estimate -> capture -> partial refund -> refund -> (void on another order) those columns, and
 * everything derived from them, must be identical to before.
 */
import { CancellationPolicyService } from '../orders/cancellation-policy.service';
import { resolveReceiptTax } from '../pdf/receipt-tax.util';
import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';
import { OrderTaxSnapshotRepository } from './order-tax-snapshot.repository';
import { planTaxInclusiveRefund } from './order-tax-snapshot.util';

jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: class HasuraSystemService {},
}));

const MONEY_COLUMNS = [
  'total_amount',
  'tax_amount',
  'pre_tax_total',
  'subtotal',
  'service_fee',
  'base_delivery_fee',
  'per_km_delivery_fee',
  'delivery_fee_waived',
  'discount_amount',
  'currency',
] as const;

const ALLOWED_ORDER_WRITES = new Set([
  'tax_status',
  'stripe_tax_calculation_id',
  'stripe_tax_transaction_id',
  'tax_breakdown',
  'tax_jurisdiction',
  'updated_at',
]);

type Row = Record<string, any>;

class FakeHasura {
  orders: Row[] = [];
  snapshots: Row[] = [];
  reversals: Row[] = [];
  orderWrites = new Set<string>();
  private seq = 0;

  async executeQuery(doc: string, vars: Row) {
    if (doc.includes('query OrderTaxContext')) {
      const o = this.orders.find((r) => r.order_number === vars.orderNumber);
      if (!o) return { orders: [] };
      const snap = this.snapshots.find((s) => s.order_id === o.id) ?? null;
      return {
        orders: [{ id: o.id, currency: o.currency, tax_status: o.tax_status, tax_snapshot: snap && { ...snap } }],
      };
    }
    if (doc.includes('query OrderTaxReversals')) {
      return { order_tax_reversals: this.reversals.filter((r) => r.snapshot_id === vars.snapshotId) };
    }
    throw new Error(`unexpected query ${doc}`);
  }

  async executeMutation(doc: string, vars: Row) {
    const out: Row = {};
    if (doc.includes('insert_order_tax_snapshots_one')) {
      const o = vars.object;
      const existing = this.snapshots.find((s) => s.order_id === o.order_id);
      if (!existing) {
        this.snapshots.push({
          id: `snap-${++this.seq}`,
          stripe_tax_transaction_id: null,
          captured_total_including_tax: null,
          ...o,
        });
      } else if (['estimated', 'void'].includes(existing.status)) {
        // on_conflict update_columns only; transaction id / captured total are not in the list.
        for (const k of [
          'status', 'voided_at', 'currency', 'stripe_tax_calculation_id', 'estimated_tax_amount',
          'pre_tax_amount', 'total_including_tax', 'effective_tax_rate', 'tax_breakdown',
          'tax_jurisdiction', 'updated_at',
        ]) {
          if (k in o) existing[k] = o[k];
        }
      }
    } else if (doc.includes('insert_order_tax_reversals_one')) {
      const o = vars.object;
      if (!this.reversals.some((r) => r.stripe_refund_id === o.stripe_refund_id)) {
        this.reversals.push({ id: `rev-${++this.seq}`, ...o });
      }
      return {};
    }
    const re =
      /(?:(\w+):\s*)?update_(\w+)\(\s*where:\s*(\{[\s\S]*?\})\s*_set:\s*(\{[\s\S]*?\})\s*\)/g;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = re.exec(doc))) {
      found = true;
      const [, alias, table, where, set] = m;
      const field = alias ?? `update_${table}`;
      const resolve = (tok: string): any => {
        if (tok.startsWith('$')) return vars[tok.slice(1)];
        if (tok === 'true') return true;
        if (tok.startsWith('[')) return [...tok.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
        return tok.slice(1, -1);
      };
      const conds = [
        ...where.matchAll(
          /(\w+):\s*\{\s*(_eq|_in|_is_null):\s*(\$\w+|"[^"]*"|\[[^\]]*\]|true)\s*\}/g
        ),
      ].map((c) => ({ key: c[1], op: c[2], val: resolve(c[3]) }));
      const sets = [...set.matchAll(/(\w+):\s*(\$\w+|"[^"]*"|null)/g)].map(
        (c) => [c[1], c[2] === 'null' ? null : resolve(c[2])] as const
      );
      const rows = (table === 'orders' ? this.orders : this.snapshots).filter((r) =>
        conds.every(({ key, op, val }) =>
          op === '_eq' ? r[key] === val : op === '_in' ? val.includes(r[key]) : (r[key] == null) === val
        )
      );
      for (const r of rows) {
        for (const [k, v] of sets) {
          r[k] = v;
          if (table === 'orders') this.orderWrites.add(k);
        }
      }
      out[field] = { affected_rows: rows.length };
    }
    if (!found && Object.keys(out).length === 0 && !doc.includes('insert_order_tax_snapshots_one')) {
      throw new Error(`unexpected mutation ${doc}`);
    }
    return out;
  }
}

const calculation = {
  id: 'taxcalc_1',
  amount_total: 11300,
  tax_amount_exclusive: 1300,
  tax_breakdown: [{ amount: 1300 }],
  customer_details: { address: { country: 'CA', state: 'ON', postal_code: 'M5V', city: 'Toronto' } },
};

const builder = {
  fromMinorUnits: (m: number) => m / 100,
  toMinorUnits: (a: number) => Math.round(a * 100),
};

function newOrder(id: string, number: string): Row {
  return {
    id,
    order_number: number,
    current_status: 'confirmed',
    currency: 'CAD',
    tax_status: 'estimated',
    // checkout today: tax_amount 0, pre_tax_total = total
    total_amount: 100,
    tax_amount: 0,
    pre_tax_total: 100,
    subtotal: 80,
    service_fee: 5,
    base_delivery_fee: 10,
    per_km_delivery_fee: 5,
    delivery_fee_waived: false,
    discount_amount: 0,
    payment_source: 'credit_card',
    payment_status: 'paid',
    business_location: { country_code: 'CA' },
  };
}

const pick = (row: Row) => Object.fromEntries(MONEY_COLUMNS.map((c) => [c, row[c]]));

const PI = {
  id: 'pi_1',
  status: 'succeeded',
  amount_received: 11300,
  metadata: { stripe_tax_calculation_id: 'taxcalc_1' },
};

describe('order tax snapshot lifecycle keeps money semantics unchanged', () => {
  let hasura: FakeHasura;
  let stripe: Record<string, jest.Mock>;
  let lifecycle: OrderTaxLifecycleService;
  let policy: CancellationPolicyService;

  beforeEach(() => {
    hasura = new FakeHasura();
    hasura.orders.push(newOrder('o-1', 'ORD-1'), newOrder('o-2', 'ORD-2'));
    stripe = {
      retrieveTaxCalculation: jest.fn().mockResolvedValue(calculation),
      retrievePaymentIntent: jest.fn(),
      createTaxTransactionFromCalculation: jest.fn().mockResolvedValue({ id: 'tax_txn_1' }),
      createTaxReversal: jest.fn().mockResolvedValue({ id: 'taxtr_1' }),
    };
    lifecycle = new OrderTaxLifecycleService(
      new OrderTaxSnapshotRepository(hasura as never),
      stripe as never,
      builder as never,
      { getTransactionByEntityId: jest.fn(), listRefundsForOrder: jest.fn() } as never
    );
    policy = new CancellationPolicyService({
      executeQuery: jest.fn(async (q: string) =>
        String(q).includes('FeePercentRows')
          ? { application_configurations: [{ country_code: 'CA', number_value: 30 }] }
          : { order_cancellation_reasons: [] }
      ),
    } as never);
  });

  const policyFor = (row: Row) =>
    policy.getPolicy(
      {
        id: row.id,
        current_status: row.current_status,
        total_amount: row.total_amount,
        base_delivery_fee: row.base_delivery_fee,
        per_km_delivery_fee: row.per_km_delivery_fee,
        delivery_fee_waived: row.delivery_fee_waived,
        tax_amount: row.tax_amount,
        service_fee: row.service_fee,
        currency: row.currency,
        payment_source: row.payment_source,
        payment_status: row.payment_status,
        business_location: row.business_location,
      },
      'client'
    );

  /** What the cancellation/commission code derives from an order row. */
  const derived = (row: Row) => {
    const deliveryFee = row.delivery_fee_waived ? 0 : row.base_delivery_fee + row.per_km_delivery_fee;
    return {
      // wallet credit / hold: the ledger amount, i.e. orders.total_amount (== tx.amount)
      ledgerAmount: row.total_amount,
      // fee base = total - delivery fee - tax_amount - service fee
      feeBase: row.total_amount - deliveryFee - row.tax_amount - row.service_fee,
      // merchant payout is built from orders.subtotal only, never from total or tax
      merchantGross: row.subtotal,
    };
  };

  const finalize = () => lifecycle.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: PI });

  it('estimate -> capture -> partial refund -> full refund leaves every money column and the fee base untouched', async () => {
    const order = hasura.orders[0];
    const before = pick(order);
    const derivedBefore = derived(order);
    const policyBefore = await policyFor(order);
    expect(derivedBefore).toEqual({ ledgerAmount: 100, feeBase: 80, merchantGross: 80 });
    expect(policyBefore.cancellationFee).toBe(24); // 30% of the 80 fee base: exercised, not trivially zero

    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    expect(hasura.snapshots[0]).toMatchObject({ status: 'estimated', total_including_tax: 113, estimated_tax_amount: 13 });
    expect(pick(order)).toEqual(before);

    await expect(finalize()).resolves.toBe('finalized');
    expect(order).toMatchObject({
      tax_status: 'finalized',
      stripe_tax_calculation_id: 'taxcalc_1',
      stripe_tax_transaction_id: 'tax_txn_1',
    });
    expect(hasura.snapshots[0]).toMatchObject({
      status: 'finalized',
      captured_total_including_tax: 113,
      stripe_tax_transaction_id: 'tax_txn_1',
    });
    expect(pick(order)).toEqual(before);
    expect(derived(order)).toEqual(derivedBefore);

    // Replay (webhook after our own capture): nothing changes, no second Stripe tax transaction.
    await expect(finalize()).resolves.toBe('already_finalized');
    expect(stripe.createTaxTransactionFromCalculation).toHaveBeenCalledTimes(1);

    await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 4000 });
    await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 4000 }); // replay
    await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_2', refundAmountMinor: 99999 });
    expect(stripe.createTaxReversal).toHaveBeenCalledTimes(2);
    expect(hasura.reversals.map((r) => [r.mode, r.amount_minor])).toEqual([
      ['partial', 4000],
      ['partial', 7300],
    ]);

    // Fee base / payout / refund inputs: identical.
    expect(pick(order)).toEqual(before);
    expect(derived(order)).toEqual(derivedBefore);
    expect(await policyFor(order)).toEqual(policyBefore);
    // The only order columns ever written are tax bookkeeping.
    expect([...hasura.orderWrites].every((c) => ALLOWED_ORDER_WRITES.has(c))).toBe(true);
  });

  it('control: rewriting the ledger to be tax-inclusive WOULD change the fee base (so the invariant has teeth)', async () => {
    const rewritten = { ...hasura.orders[0], total_amount: 113 }; // tax_amount left 0, as a naive finalizer would
    const policyRewritten = await policyFor(rewritten);
    expect(derived(rewritten).feeBase).toBe(93);
    expect(policyRewritten.cancellationFee).toBeCloseTo(27.9, 2);
    expect(policyRewritten.cancellationFee).not.toBe(24);
  });

  describe('money flows of a captured, tax-bearing order', () => {
    // Manual capture: tx.amount == orders.total_amount == 100.00 (pre-tax), card charged 113.00.
    const LEDGER = 10000;
    const CHARGED = 11300;
    const COMMISSION_PCT = 20;
    const payout = (subtotal: number) => {
      // Same formula as CommissionsService.calculateOrderSubtotalBreakdown
      const rendasua = (subtotal * COMMISSION_PCT) / 100;
      return { business: subtotal - rendasua, rendasua };
    };

    it('wallet credit, hold, merchant payout and fee base are identical before and after finalization; the merchant never gets tax', async () => {
      const order = hasura.orders[0];
      const before = derived(order);
      const payoutBefore = payout(order.subtotal);
      await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
      await finalize();
      const after = derived(order);
      expect(after).toEqual(before);
      expect(order.total_amount).toBe(100); // wallet deposit == tx.amount == total_amount; hold == total_amount
      expect(payout(order.subtotal)).toEqual(payoutBefore);
      // Merchant + platform commission split the subtotal and nothing else: tax (13) is in neither.
      const split = payout(order.subtotal);
      expect(split.business + split.rendasua).toBe(order.subtotal);
      expect(split.business + split.rendasua).toBeLessThan(order.total_amount);
      expect(CHARGED / 100 - order.total_amount).toBe(13); // the tax sits in the Stripe pool, off-ledger
    });

    it('receipt prints the tax actually collected and the amount actually charged (MAJOR 1)', async () => {
      const order = hasura.orders[0];
      await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
      await finalize();
      const view = resolveReceiptTax({
        total_amount: order.total_amount,
        tax_amount: order.tax_amount,
        tax_jurisdiction: order.tax_jurisdiction,
        tax_snapshot: hasura.snapshots[0] as never,
      });
      expect(view).toEqual({ taxAmount: 13, totalAmount: 113, showJurisdiction: true });
      // Never a jurisdiction with a zero tax line:
      const legacy = resolveReceiptTax({ total_amount: 100, tax_amount: 0, tax_snapshot: null });
      expect(legacy).toEqual({ taxAmount: 0, totalAmount: 100, showJurisdiction: false });
    });

    /** Run a sequence of ledger-term refund requests through the real planner. */
    function run(requests: number[]) {
      let refundedLedger = 0;
      let refundedTax = 0;
      const refunds: Array<{ ledger: number; tax: number; card: number }> = [];
      for (const requested of requests) {
        const plan = planTaxInclusiveRefund({
          ledgerTotalMinor: LEDGER,
          chargedMinor: CHARGED,
          refundedLedgerMinor: refundedLedger,
          refundedTaxMinor: refundedTax,
          requestedLedgerMinor: requested,
        });
        refundedLedger += plan.ledgerMinor;
        refundedTax += plan.taxMinor;
        refunds.push({ ledger: plan.ledgerMinor, tax: plan.taxMinor, card: plan.cardMinor });
      }
      return { refunds, refundedLedger, refundedTax, refundedCard: refundedLedger + refundedTax };
    }

    it('FULL refund: customer gets back exactly what was charged; wallet nets to zero; platform tax liability is zero', async () => {
      await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
      await finalize();
      const r = run([LEDGER]);
      expect(r.refunds).toEqual([{ ledger: 10000, tax: 1300, card: 11300 }]);
      expect(r.refundedCard).toBe(CHARGED); // not under-refunded
      expect(r.refundedLedger).toBe(LEDGER); // wallet reversal (ledger part) == wallet deposit
      expect(r.refundedTax).toBe(CHARGED - LEDGER); // tax part == tax collected: liability 0

      // The Stripe tax reversal gets the card amount and the snapshot ledger agrees.
      await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: r.refunds[0].card });
      expect(stripe.createTaxReversal).toHaveBeenCalledWith(expect.objectContaining({ mode: 'full', flatAmountMinor: 11300 }));
      expect(hasura.reversals.reduce((a, x) => a + x.amount_minor, 0)).toBe(r.refundedCard);
    });

    it('refund cap: the cap is tax-inclusive (charged) for finalized orders, and nobody is over- or under-paid across many partials', () => {
      const r = run([3000, 3000, 3000, 999999]); // the last request exceeds what is left
      expect(r.refundedCard).toBe(CHARGED); // capped at exactly the amount charged
      expect(r.refundedLedger).toBe(LEDGER);
      expect(r.refunds.every((x) => x.card === x.ledger + x.tax && x.tax >= 0)).toBe(true);
      const again = run([...r.refunds.map((x) => x.ledger), 1]);
      expect(again.refunds[again.refunds.length - 1].card).toBe(0); // nothing left to refund
    });

    it('cancellation-fee partial: the retained fee keeps its proportional tax; refund + retained == charged', () => {
      const fee = 2400; // 30% of 80.00 fee base
      const r = run([LEDGER - fee]);
      expect(r.refunds[0]).toEqual({ ledger: 7600, tax: 988, card: 8588 });
      const retained = CHARGED - r.refundedCard;
      expect(retained).toBe(fee + (1300 - 988)); // fee + the tax on the fee
      expect(retained).toBeGreaterThan(0);
    });

    it('legacy order (ledger already includes tax / pre-feature): refund cap and amounts are unchanged', () => {
      const plan = planTaxInclusiveRefund({
        ledgerTotalMinor: 11300,
        chargedMinor: 11300,
        refundedLedgerMinor: 4000,
        refundedTaxMinor: 0,
        requestedLedgerMinor: 99999,
      });
      expect(plan).toEqual({ ledgerMinor: 7300, taxMinor: 0, cardMinor: 7300 });
    });

    it('pre-tax-only (not finalized) orders keep the old cap: tx.amount - refunds', () => {
      const refundCap = (txAmount: number, refunded: number) => Math.max(0, txAmount - refunded);
      expect(refundCap(100, 40)).toBe(60);
      expect(refundCap(100, 140)).toBe(0);
    });

    it('wallet reversal uses the ledger part only: deposit 100 - reversals of the ledger parts == 0, never negative', () => {
      const r = run([5000, 5000]);
      const walletAfter = LEDGER - r.refunds.reduce((a, x) => a + x.ledger, 0);
      expect(walletAfter).toBe(0);
      // If the callback had used the card amount (ledger + tax) the wallet would be overdrawn by the tax.
      expect(LEDGER - r.refunds.reduce((a, x) => a + x.card, 0)).toBe(-1300);
    });
  });

  it('a cancelled, never-captured order becomes void without touching money; a LATER capture re-opens it and finalizes (void is not terminal)', async () => {
    const cancelled = hasura.orders[1];
    const before = pick(cancelled);
    await lifecycle.recordEstimate({ orderId: 'o-2', currency: 'CAD', calculation: calculation as never });
    await lifecycle.voidForOrder('ORD-2');
    expect(cancelled.tax_status).toBe('void');
    expect(hasura.snapshots[0]).toMatchObject({ status: 'void' });
    expect(pick(cancelled)).toEqual(before);

    // The authorization turned out to have been captured (race / drift): the capture wins.
    await expect(
      lifecycle.finalizeAfterCapture({ orderNumber: 'ORD-2', paymentIntent: { ...PI, id: 'pi_2' } })
    ).resolves.toBe('finalized');
    expect(cancelled.tax_status).toBe('finalized');
    expect(hasura.snapshots[0]).toMatchObject({ status: 'finalized', voided_at: null, stripe_tax_transaction_id: 'tax_txn_1' });
    expect(pick(cancelled)).toEqual(before);

    // Captured order: cancel/void is a no-op.
    await lifecycle.voidForOrder('ORD-2');
    expect(cancelled.tax_status).toBe('finalized');
  });

  it('snapshot-side guard (kills the markFinalized mutant): a finalized snapshot is never finalized/overwritten again, even when the order row drifted to estimated', async () => {
    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    await finalize();
    const snapshotBefore = { ...hasura.snapshots[0] };
    // Order row drifts back to estimated (manual edit / partial failure): snapshot must stay put.
    hasura.orders[0].tax_status = 'estimated';
    const repo = new OrderTaxSnapshotRepository(hasura as never);
    const res = await repo.markFinalized({
      orderId: 'o-1',
      calculationId: 'taxcalc_OTHER',
      taxTransactionId: 'tax_txn_OTHER',
      capturedTotalIncludingTax: 999,
      taxBreakdown: null,
      taxJurisdiction: null,
    });
    expect(res.snapshotsUpdated).toBe(0);
    expect(hasura.snapshots[0]).toEqual(snapshotBefore);
  });

  it('tax failures leave the order estimated and money untouched, then a retry heals (MAJOR 2)', async () => {
    const order = hasura.orders[0];
    const before = pick(order);
    stripe.createTaxTransactionFromCalculation.mockRejectedValue(new Error('stripe down'));
    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    await expect(finalize()).resolves.toBe('deferred');
    expect(order.tax_status).toBe('estimated');
    expect(hasura.snapshots[0].status).toBe('estimated'); // never finalized without a txn id
    expect(pick(order)).toEqual(before);

    stripe.createTaxTransactionFromCalculation.mockResolvedValue({ id: 'tax_txn_1' });
    await expect(finalize()).resolves.toBe('finalized');
    expect(order.tax_status).toBe('finalized');
    expect(hasura.snapshots[0].stripe_tax_transaction_id).toBe('tax_txn_1');
    expect(pick(order)).toEqual(before);
  });

  it('HEAL: an order finalized with a NULL transaction id (old bug / partial write) is repaired in place', async () => {
    const order = hasura.orders[0];
    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    order.tax_status = 'finalized';
    Object.assign(hasura.snapshots[0], { status: 'finalized', stripe_tax_transaction_id: null, captured_total_including_tax: null });
    await expect(finalize()).resolves.toBe('healed');
    expect(order.stripe_tax_transaction_id).toBe('tax_txn_1');
    expect(hasura.snapshots[0]).toMatchObject({
      status: 'finalized',
      stripe_tax_transaction_id: 'tax_txn_1',
      captured_total_including_tax: 113,
    });
    // A value that is already set is never overwritten by a later heal.
    stripe.createTaxTransactionFromCalculation.mockResolvedValue({ id: 'tax_txn_OTHER' });
    await finalize();
    expect(hasura.snapshots[0].stripe_tax_transaction_id).toBe('tax_txn_1');
  });

  it('a Stripe reversal failure writes no ledger row and is retried by the next attempt with the same key', async () => {
    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    await finalize();
    stripe.createTaxReversal.mockRejectedValueOnce(new Error('stripe tax 500'));
    await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 4000 });
    expect(hasura.reversals).toHaveLength(0);
    await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 4000 });
    expect(hasura.reversals).toHaveLength(1);
    // Same Stripe idempotency key on both attempts, so Stripe never reverses twice.
    expect(stripe.createTaxReversal.mock.calls.map((c) => c[0].idempotencyKey)).toEqual([
      'tax_reversal_re_1_4000',
      'tax_reversal_re_1_4000',
    ]);
  });
});

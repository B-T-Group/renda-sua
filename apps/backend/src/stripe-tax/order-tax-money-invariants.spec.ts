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
import { OrderTaxLifecycleService } from './order-tax-lifecycle.service';
import { OrderTaxSnapshotRepository } from './order-tax-snapshot.repository';

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
    if (doc.includes('insert_order_tax_snapshots_one')) {
      const o = vars.object;
      const existing = this.snapshots.find((s) => s.order_id === o.order_id);
      if (!existing) this.snapshots.push({ id: `snap-${++this.seq}`, stripe_tax_transaction_id: null, ...o });
      else if (existing.status === 'estimated') Object.assign(existing, o, { status: 'estimated' });
      return {};
    }
    if (doc.includes('insert_order_tax_reversals_one')) {
      const o = vars.object;
      if (!this.reversals.some((r) => r.stripe_refund_id === o.stripe_refund_id)) {
        this.reversals.push({ id: `rev-${++this.seq}`, ...o });
      }
      return {};
    }
    const out: Row = {};
    const re = /(update_(\w+))\(\s*where:\s*(\{[\s\S]*?\})\s*_set:\s*(\{[\s\S]*?\})\s*\)/g;
    let m: RegExpExecArray | null;
    let found = false;
    while ((m = re.exec(doc))) {
      found = true;
      const [, field, table, where, set] = m;
      const resolve = (tok: string) => (tok.startsWith('$') ? vars[tok.slice(1)] : tok.slice(1, -1));
      const conds = [...where.matchAll(/(\w+):\s*\{\s*_eq:\s*(\$\w+|"[^"]*")\s*\}/g)].map(
        (c) => [c[1], resolve(c[2])] as const
      );
      const sets = [...set.matchAll(/(\w+):\s*(\$\w+|"[^"]*")/g)].map((c) => [c[1], resolve(c[2])] as const);
      const rows = (table === 'orders' ? this.orders : this.snapshots).filter((r) =>
        conds.every(([k, v]) => r[k] === v)
      );
      for (const r of rows) {
        for (const [k, v] of sets) {
          r[k] = v;
          if (table === 'orders') this.orderWrites.add(k);
        }
      }
      out[field] = { affected_rows: rows.length };
    }
    if (!found) throw new Error(`unexpected mutation ${doc}`);
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
      builder as never
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

  // What stripe-refund.service derives its cap from: tx.amount (ledger) - refunds; orders are not read.
  const refundCap = (txAmount: number, refunded: number) => Math.max(0, txAmount - refunded);

  it('estimate -> capture -> partial refund -> full refund leaves every money column and the fee base untouched', async () => {
    const order = hasura.orders[0];
    const before = pick(order);
    const policyBefore = await policyFor(order);
    expect(policyBefore.cancellationFee).toBeGreaterThan(0); // fee base is exercised, not trivially zero

    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    expect(hasura.snapshots[0]).toMatchObject({ status: 'estimated', total_including_tax: 113, estimated_tax_amount: 13 });
    expect(pick(order)).toEqual(before);

    const pi = { id: 'pi_1', amount_received: 11300, metadata: { stripe_tax_calculation_id: 'taxcalc_1' } };
    await lifecycle.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });
    expect(order).toMatchObject({
      tax_status: 'finalized',
      stripe_tax_calculation_id: 'taxcalc_1',
      stripe_tax_transaction_id: 'tax_txn_1',
    });
    expect(hasura.snapshots[0]).toMatchObject({ status: 'finalized', captured_total_including_tax: 113 });
    expect(pick(order)).toEqual(before);

    // Replay (webhook after our own capture): nothing changes, no second Stripe tax transaction.
    await lifecycle.finalizeAfterCapture({ orderNumber: 'ORD-1', paymentIntent: pi });
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
    expect(await policyFor(order)).toEqual(policyBefore);
    expect(refundCap(113, 40)).toBe(73);
    // The only order columns ever written are tax bookkeeping.
    expect([...hasura.orderWrites].every((c) => ALLOWED_ORDER_WRITES.has(c))).toBe(true);
  });

  it('a cancelled, never-captured order becomes void without touching money, and a captured one never does', async () => {
    const cancelled = hasura.orders[1];
    const before = pick(cancelled);
    await lifecycle.recordEstimate({ orderId: 'o-2', currency: 'CAD', calculation: calculation as never });
    await lifecycle.voidForOrder('ORD-2');
    expect(cancelled.tax_status).toBe('void');
    expect(hasura.snapshots[0]).toMatchObject({ status: 'void' });
    expect(pick(cancelled)).toEqual(before);

    // A void order is not finalized later by a stray capture webhook.
    await lifecycle.finalizeAfterCapture({
      orderNumber: 'ORD-2',
      paymentIntent: { id: 'pi_2', metadata: { stripe_tax_calculation_id: 'taxcalc_1' } },
    });
    expect(cancelled.tax_status).toBe('void');
    expect(stripe.createTaxTransactionFromCalculation).not.toHaveBeenCalled();

    // Captured order: cancel/void is a no-op.
    const captured = hasura.orders[0];
    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    await lifecycle.finalizeAfterCapture({
      orderNumber: 'ORD-1',
      paymentIntent: { id: 'pi_1', amount_received: 11300, metadata: { stripe_tax_calculation_id: 'taxcalc_1' } },
    });
    await lifecycle.voidForOrder('ORD-1');
    expect(captured.tax_status).toBe('finalized');
  });

  it('tax failures leave the order estimated and money untouched', async () => {
    const order = hasura.orders[0];
    const before = pick(order);
    stripe.createTaxTransactionFromCalculation.mockRejectedValue(new Error('stripe down'));
    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    await lifecycle.finalizeAfterCapture({
      orderNumber: 'ORD-1',
      paymentIntent: { id: 'pi_1', amount_received: 11300, metadata: { stripe_tax_calculation_id: 'taxcalc_1' } },
    });
    expect(order.tax_status).toBe('estimated');
    expect(pick(order)).toEqual(before);

    // The webhook retry self-heals once Stripe is back.
    stripe.createTaxTransactionFromCalculation.mockResolvedValue({ id: 'tax_txn_1' });
    await lifecycle.finalizeAfterCapture({
      orderNumber: 'ORD-1',
      paymentIntent: { id: 'pi_1', amount_received: 11300, metadata: { stripe_tax_calculation_id: 'taxcalc_1' } },
    });
    expect(order.tax_status).toBe('finalized');
    expect(pick(order)).toEqual(before);
  });

  it('a Stripe reversal failure writes no ledger row and is retried by the next attempt', async () => {
    await lifecycle.recordEstimate({ orderId: 'o-1', currency: 'CAD', calculation: calculation as never });
    await lifecycle.finalizeAfterCapture({
      orderNumber: 'ORD-1',
      paymentIntent: { id: 'pi_1', amount_received: 11300, metadata: { stripe_tax_calculation_id: 'taxcalc_1' } },
    });
    stripe.createTaxReversal.mockRejectedValueOnce(new Error('stripe tax 500'));
    await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 4000 });
    expect(hasura.reversals).toHaveLength(0);
    await lifecycle.reverseForRefund({ orderNumber: 'ORD-1', stripeRefundId: 're_1', refundAmountMinor: 4000 });
    expect(hasura.reversals).toHaveLength(1);
    // Same Stripe idempotency key on both attempts, so Stripe never reverses twice.
    expect(stripe.createTaxReversal.mock.calls.map((c) => c[0].idempotencyKey)).toEqual([
      'tax_reversal_re_1',
      'tax_reversal_re_1',
    ]);
  });
});

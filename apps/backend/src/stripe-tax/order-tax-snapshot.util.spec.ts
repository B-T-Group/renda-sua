import type Stripe from 'stripe';
import {
  buildSnapshotFromCalculation,
  normalizeCalculationBreakdown,
  normalizeSessionBreakdown,
  planTaxInclusiveRefund,
  planTaxReversal,
} from './order-tax-snapshot.util';

const fromMinor = (minor: number, currency: string) =>
  ['XAF', 'XOF', 'JPY'].includes(currency.toUpperCase()) ? minor : minor / 100;

function calc(over: Record<string, unknown> = {}): Stripe.Tax.Calculation {
  return {
    id: 'taxcalc_1',
    amount_total: 11300,
    tax_amount_exclusive: 1300,
    tax_breakdown: [
      {
        amount: 1300,
        taxability_reason: 'standard_rated',
        tax_rate_details: { country: 'CA', state: 'ON', percentage_decimal: '13.0' },
      },
    ],
    customer_details: {
      address: { country: 'CA', state: 'ON', postal_code: 'M5V2T6', city: 'Toronto' },
    },
    ...over,
  } as unknown as Stripe.Tax.Calculation;
}

describe('buildSnapshotFromCalculation', () => {
  it('maps a CAD calculation to snapshot columns', () => {
    expect(buildSnapshotFromCalculation(calc(), 'cad', fromMinor)).toEqual({
      currency: 'CAD',
      stripe_tax_calculation_id: 'taxcalc_1',
      estimated_tax_amount: 13,
      pre_tax_amount: 100,
      total_including_tax: 113,
      effective_tax_rate: 13,
      tax_breakdown: {
        version: 1,
        source: 'tax_calculation',
        taxes: [
          {
            amount_minor: 1300,
            taxable_amount_minor: null,
            inclusive: false,
            display_name: null,
            percentage: '13.0',
            country: 'CA',
            state: 'ON',
            tax_type: null,
            taxability_reason: 'standard_rated',
          },
        ],
      },
      tax_jurisdiction: {
        country: 'CA',
        state: 'ON',
        postal_code: 'M5V2T6',
        city: 'Toronto',
      },
    });
  });

  it('handles zero-decimal currencies', () => {
    const snap = buildSnapshotFromCalculation(
      calc({ amount_total: 5900, tax_amount_exclusive: 900 }),
      'XAF',
      fromMinor
    );
    expect(snap.total_including_tax).toBe(5900);
    expect(snap.estimated_tax_amount).toBe(900);
    expect(snap.pre_tax_amount).toBe(5000);
    expect(snap.effective_tax_rate).toBe(18);
  });

  it('keeps a null rate for a zero pre-tax amount and null jurisdiction without an address', () => {
    const snap = buildSnapshotFromCalculation(
      calc({
        amount_total: 0,
        tax_amount_exclusive: 0,
        customer_details: null,
        tax_breakdown: undefined,
      }),
      'CAD',
      fromMinor
    );
    expect(snap.effective_tax_rate).toBeNull();
    expect(snap.tax_jurisdiction).toBeNull();
    expect(snap.tax_breakdown).toBeNull();
  });

  it('treats inclusive-only tax as no exclusive tax added', () => {
    const snap = buildSnapshotFromCalculation(
      calc({ amount_total: 10000, tax_amount_exclusive: 0 }),
      'CAD',
      fromMinor
    );
    expect(snap.estimated_tax_amount).toBe(0);
    expect(snap.pre_tax_amount).toBe(100);
  });
});

describe('planTaxReversal', () => {
  it('is a full reversal when nothing was reversed and the refund covers the total', () => {
    expect(planTaxReversal({ totalMinor: 11300, reversedMinor: 0, refundMinor: 11300 })).toEqual({
      mode: 'full',
      amountMinor: 11300,
    });
    expect(planTaxReversal({ totalMinor: 11300, reversedMinor: 0, refundMinor: 99999 })).toEqual({
      mode: 'full',
      amountMinor: 11300,
    });
  });

  it('is a partial reversal for a smaller refund', () => {
    expect(planTaxReversal({ totalMinor: 11300, reversedMinor: 0, refundMinor: 4000 })).toEqual({
      mode: 'partial',
      amountMinor: 4000,
    });
  });

  it('caps a later refund at what is left on the transaction', () => {
    expect(planTaxReversal({ totalMinor: 11300, reversedMinor: 10000, refundMinor: 4000 })).toEqual({
      mode: 'partial',
      amountMinor: 1300,
    });
  });

  it('a remainder refund after a partial one stays partial (never "full" twice)', () => {
    expect(planTaxReversal({ totalMinor: 11300, reversedMinor: 4000, refundMinor: 7300 })).toEqual({
      mode: 'partial',
      amountMinor: 7300,
    });
  });

  it.each([
    [{ totalMinor: 11300, reversedMinor: 11300, refundMinor: 100 }],
    [{ totalMinor: 11300, reversedMinor: 12000, refundMinor: 100 }],
    [{ totalMinor: 11300, reversedMinor: 0, refundMinor: 0 }],
    [{ totalMinor: 11300, reversedMinor: 0, refundMinor: -5 }],
    [{ totalMinor: 0, reversedMinor: 0, refundMinor: 100 }],
    [{ totalMinor: NaN, reversedMinor: 0, refundMinor: 100 }],
  ])('returns null when there is nothing to reverse (%j)', (p) => {
    expect(planTaxReversal(p)).toBeNull();
  });
});

describe('tax_breakdown normalization (one stored shape for every path)', () => {
  it('maps a Tax Calculation and a Checkout Session breakdown to the same line shape', () => {
    const fromCalc = normalizeCalculationBreakdown({
      tax_breakdown: [
        {
          amount: 1300,
          inclusive: false,
          taxable_amount: 10000,
          taxability_reason: 'standard_rated',
          tax_rate_details: {
            country: 'CA',
            state: 'ON',
            percentage_decimal: '13',
            tax_type: 'hst',
            display_name: 'HST',
          },
        },
      ],
    } as never);
    const fromSession = normalizeSessionBreakdown({
      taxes: [
        {
          amount: 1300,
          taxable_amount: 10000,
          taxability_reason: 'standard_rated',
          rate: {
            display_name: 'HST',
            percentage: 13,
            inclusive: false,
            country: 'CA',
            state: 'ON',
            tax_type: 'hst',
          },
        },
      ],
    });
    expect(fromCalc?.taxes).toEqual(fromSession?.taxes);
    expect(fromCalc?.taxes[0]).toEqual({
      amount_minor: 1300,
      taxable_amount_minor: 10000,
      inclusive: false,
      display_name: 'HST',
      percentage: '13',
      country: 'CA',
      state: 'ON',
      tax_type: 'hst',
      taxability_reason: 'standard_rated',
    });
    expect(fromCalc).toMatchObject({ version: 1, source: 'tax_calculation' });
    expect(fromSession).toMatchObject({ version: 1, source: 'checkout_session' });
  });

  it('is null when Stripe sent no breakdown', () => {
    expect(normalizeCalculationBreakdown({} as never)).toBeNull();
    expect(normalizeSessionBreakdown(null)).toBeNull();
    expect(normalizeSessionBreakdown({})).toBeNull();
  });

  it('survives sparse rows without throwing', () => {
    expect(normalizeCalculationBreakdown({ tax_breakdown: [{}] } as never)?.taxes[0]).toEqual({
      amount_minor: 0,
      taxable_amount_minor: null,
      inclusive: false,
      display_name: null,
      percentage: null,
      country: null,
      state: null,
      tax_type: null,
      taxability_reason: null,
    });
  });
});

describe('planTaxInclusiveRefund', () => {
  // 100.00 ledger, 113.00 charged: tax 13.00
  const base = { ledgerTotalMinor: 10000, chargedMinor: 11300, refundedLedgerMinor: 0, refundedTaxMinor: 0 };

  it('a full refund returns the ledger amount plus every cent of tax', () => {
    expect(planTaxInclusiveRefund({ ...base, requestedLedgerMinor: 10000 })).toEqual({
      ledgerMinor: 10000,
      taxMinor: 1300,
      cardMinor: 11300,
    });
  });

  it('a partial refund returns the same share of the tax', () => {
    expect(planTaxInclusiveRefund({ ...base, requestedLedgerMinor: 4000 })).toEqual({
      ledgerMinor: 4000,
      taxMinor: 520,
      cardMinor: 4520,
    });
  });

  it('the last refund takes whatever tax is left, so the refunds sum to exactly the charge', () => {
    const first = planTaxInclusiveRefund({ ...base, requestedLedgerMinor: 3333 });
    const second = planTaxInclusiveRefund({
      ...base,
      refundedLedgerMinor: first.ledgerMinor,
      refundedTaxMinor: first.taxMinor,
      requestedLedgerMinor: 99999,
    });
    expect(first.taxMinor).toBe(433);
    expect(second.ledgerMinor).toBe(6667);
    expect(first.cardMinor + second.cardMinor).toBe(11300);
  });

  it('never refunds more than the charge, for any split', () => {
    for (const charged of [10000, 10013, 11300, 11299, 10001]) {
      for (const step of [1, 7, 333, 2500, 3333, 9999]) {
        let ledger = 0;
        let tax = 0;
        let card = 0;
        for (let i = 0; i < 40 && ledger < 10000; i++) {
          const p = planTaxInclusiveRefund({
            ledgerTotalMinor: 10000,
            chargedMinor: charged,
            refundedLedgerMinor: ledger,
            refundedTaxMinor: tax,
            requestedLedgerMinor: step,
          });
          expect(p.cardMinor).toBe(p.ledgerMinor + p.taxMinor);
          expect(p.taxMinor).toBeGreaterThanOrEqual(0);
          ledger += p.ledgerMinor;
          tax += p.taxMinor;
          card += p.cardMinor;
          expect(card).toBeLessThanOrEqual(charged);
          if (p.ledgerMinor === 0) break;
        }
        if (ledger === 10000) expect(card).toBe(charged);
      }
    }
  });

  it('a legacy order (ledger already equals the charge) gets no tax top-up', () => {
    expect(
      planTaxInclusiveRefund({ ledgerTotalMinor: 11300, chargedMinor: 11300, refundedLedgerMinor: 0, refundedTaxMinor: 0, requestedLedgerMinor: 11300 })
    ).toEqual({ ledgerMinor: 11300, taxMinor: 0, cardMinor: 11300 });
  });

  it('an unknown charge (0) degrades to a pre-tax refund', () => {
    expect(planTaxInclusiveRefund({ ...base, chargedMinor: 0, requestedLedgerMinor: 10000 })).toEqual({
      ledgerMinor: 10000,
      taxMinor: 0,
      cardMinor: 10000,
    });
  });

  it('a fee-waiver partial capture: tax is only what was collected', () => {
    // ledger reduced to 80.00, card captured 90.40 (80 + 10.40 tax)
    expect(
      planTaxInclusiveRefund({ ledgerTotalMinor: 8000, chargedMinor: 9040, refundedLedgerMinor: 0, refundedTaxMinor: 0, requestedLedgerMinor: 8000 })
    ).toEqual({ ledgerMinor: 8000, taxMinor: 1040, cardMinor: 9040 });
  });

  it('is capped by the ledger left and refunds nothing once it is gone', () => {
    expect(
      planTaxInclusiveRefund({ ...base, refundedLedgerMinor: 10000, refundedTaxMinor: 1300, requestedLedgerMinor: 500 })
    ).toEqual({ ledgerMinor: 0, taxMinor: 0, cardMinor: 0 });
    expect(planTaxInclusiveRefund({ ...base, requestedLedgerMinor: -5 }).cardMinor).toBe(0);
  });

  it('a retained cancellation fee keeps its share of the tax with the platform', () => {
    // 10.00 fee withheld of 100.00: refunds 90.00 + 90% of 13.00 = 11.70
    expect(planTaxInclusiveRefund({ ...base, requestedLedgerMinor: 9000 })).toEqual({
      ledgerMinor: 9000,
      taxMinor: 1170,
      cardMinor: 10170,
    });
  });
});

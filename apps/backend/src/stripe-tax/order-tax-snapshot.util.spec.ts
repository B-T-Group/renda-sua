import type Stripe from 'stripe';
import {
  buildSnapshotFromCalculation,
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
      tax_breakdown: calc().tax_breakdown,
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

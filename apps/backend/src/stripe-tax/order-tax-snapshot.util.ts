import type Stripe from 'stripe';

/** Row shape written to public.order_tax_snapshots at checkout. */
export interface OrderTaxSnapshotInput {
  currency: string;
  stripe_tax_calculation_id: string;
  estimated_tax_amount: number;
  pre_tax_amount: number;
  total_including_tax: number;
  effective_tax_rate: number | null;
  tax_breakdown: unknown;
  tax_jurisdiction: Record<string, string> | null;
}

type MinorToMajor = (minor: number, currency: string) => number;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Map a Stripe Tax calculation to the snapshot columns. Pure: no Stripe or DB access.
 * `total_including_tax` is the calculation's amount_total, i.e. what the PaymentIntent is
 * raised to; `pre_tax_amount` is that minus the exclusive tax.
 */
export function buildSnapshotFromCalculation(
  calculation: Stripe.Tax.Calculation,
  currency: string,
  fromMinor: MinorToMajor
): OrderTaxSnapshotInput {
  const total = round2(fromMinor(calculation.amount_total, currency));
  const tax = round2(fromMinor(calculation.tax_amount_exclusive, currency));
  const preTax = round2(total - tax);
  const addr = calculation.customer_details?.address;
  return {
    currency: currency.toUpperCase(),
    stripe_tax_calculation_id: calculation.id ?? '',
    estimated_tax_amount: tax,
    pre_tax_amount: preTax,
    total_including_tax: total,
    effective_tax_rate:
      preTax > 0 ? Math.round((tax / preTax) * 100 * 10000) / 10000 : null,
    tax_breakdown: calculation.tax_breakdown ?? null,
    tax_jurisdiction: addr
      ? {
          country: addr.country ?? '',
          state: addr.state ?? '',
          postal_code: addr.postal_code ?? '',
          city: addr.city ?? '',
        }
      : null,
  };
}

export interface TaxReversalPlan {
  mode: 'full' | 'partial';
  /** Positive tax-inclusive minor units to reverse (Stripe flat_amount is its negative). */
  amountMinor: number;
}

/**
 * How much of the Stripe Tax transaction a refund reverses.
 *
 * - `totalMinor`: tax-inclusive total of the original tax transaction.
 * - `reversedMinor`: already reversed by earlier refunds.
 * - `refundMinor`: money the customer gets back with this refund.
 *
 * The reversal is capped at what is left on the transaction (Stripe rejects more). It is
 * `full` only when nothing was reversed yet and this refund covers the whole transaction;
 * every other case is a `partial` flat-amount reversal.
 */
export function planTaxReversal(params: {
  totalMinor: number;
  reversedMinor: number;
  refundMinor: number;
}): TaxReversalPlan | null {
  const { totalMinor, reversedMinor, refundMinor } = params;
  if (!(totalMinor > 0) || !(refundMinor > 0)) return null;
  const remaining = totalMinor - Math.max(0, reversedMinor);
  if (remaining <= 0) return null;
  if (reversedMinor <= 0 && refundMinor >= totalMinor) {
    return { mode: 'full', amountMinor: totalMinor };
  }
  return { mode: 'partial', amountMinor: Math.min(refundMinor, remaining) };
}

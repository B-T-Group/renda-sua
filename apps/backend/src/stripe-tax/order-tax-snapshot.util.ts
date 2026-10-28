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
    tax_breakdown: normalizeCalculationBreakdown(calculation),
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

/** One tax line, same shape whichever Stripe object it came from. */
export interface NormalizedTaxLine {
  amount_minor: number;
  taxable_amount_minor: number | null;
  inclusive: boolean;
  display_name: string | null;
  /** Percentage as a string, e.g. "13". */
  percentage: string | null;
  country: string | null;
  state: string | null;
  tax_type: string | null;
  taxability_reason: string | null;
}

/**
 * The single stored shape of `tax_breakdown` (snapshot and orders). The Tax Calculation
 * API and the Checkout Session `total_details.breakdown` describe the same lines with
 * different fields; both are mapped here so a consumer never has to branch on the source.
 */
export interface NormalizedTaxBreakdown {
  version: 1;
  source: 'tax_calculation' | 'checkout_session';
  taxes: NormalizedTaxLine[];
}

const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : null;
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/** Tax Calculation -> normalized breakdown (null when Stripe sent no breakdown). */
export function normalizeCalculationBreakdown(
  calculation: Pick<Stripe.Tax.Calculation, 'tax_breakdown'>
): NormalizedTaxBreakdown | null {
  const rows = calculation.tax_breakdown;
  if (!Array.isArray(rows)) return null;
  return {
    version: 1,
    source: 'tax_calculation',
    taxes: rows.map((row: any) => ({
      amount_minor: Number(row?.amount ?? 0),
      taxable_amount_minor: numOrNull(row?.taxable_amount),
      inclusive: row?.inclusive === true,
      display_name:
        strOrNull(row?.tax_rate_details?.display_name) ??
        strOrNull(row?.jurisdiction?.display_name),
      percentage: strOrNull(row?.tax_rate_details?.percentage_decimal),
      country:
        strOrNull(row?.tax_rate_details?.country) ??
        strOrNull(row?.jurisdiction?.country),
      state:
        strOrNull(row?.tax_rate_details?.state) ??
        strOrNull(row?.jurisdiction?.state),
      tax_type: strOrNull(row?.tax_rate_details?.tax_type),
      taxability_reason: strOrNull(row?.taxability_reason),
    })),
  };
}

/** Checkout Session `total_details.breakdown` -> normalized breakdown. */
export function normalizeSessionBreakdown(
  breakdown: { taxes?: unknown[] } | null | undefined
): NormalizedTaxBreakdown | null {
  if (!breakdown || !Array.isArray(breakdown.taxes)) return null;
  return {
    version: 1,
    source: 'checkout_session',
    taxes: breakdown.taxes.map((row: any) => ({
      amount_minor: Number(row?.amount ?? 0),
      taxable_amount_minor: numOrNull(row?.taxable_amount),
      inclusive: row?.rate?.inclusive === true,
      display_name: strOrNull(row?.rate?.display_name),
      percentage:
        row?.rate?.percentage != null ? String(row.rate.percentage) : null,
      country: strOrNull(row?.rate?.country),
      state: strOrNull(row?.rate?.state),
      tax_type: strOrNull(row?.rate?.tax_type),
      taxability_reason: strOrNull(row?.taxability_reason),
    })),
  };
}

/**
 * Where the money of one refund goes, in minor units. `ledgerMinor` is the part measured
 * in the order's own (pre-tax) ledger terms: it is what stripe_refunds.amount stores, what
 * the wallet reversal and the merchant clawback use. `taxMinor` is the tax returned to the
 * card on top of it. The Stripe refund (and the Stripe Tax reversal) is their sum.
 */
export interface TaxInclusiveRefundPlan {
  ledgerMinor: number;
  taxMinor: number;
  cardMinor: number;
}

/**
 * Tax-inclusive refund for an order with a finalized tax snapshot.
 *
 * - `ledgerTotalMinor`: tx.amount, the pre-tax ledger amount that was credited to the wallet.
 * - `chargedMinor`: card money actually captured (PaymentIntent amount_received).
 * - `refundedLedgerMinor` / `refundedTaxMinor`: sums over earlier succeeded refunds.
 * - `requestedLedgerMinor`: what the caller asks to refund, in ledger terms.
 *
 * Tax collected = charged - ledger (never negative; 0 for legacy orders whose ledger
 * already includes tax). The tax of a partial refund is the same share of the collected tax
 * as the ledger share (a blended rate; exact when a single rate applies). Whoever refunds the
 * last of the ledger gets all the tax that is still left, so the sum of every refund is
 * exactly the amount charged: no rounding dust stays with the platform or is over-refunded.
 */
export function planTaxInclusiveRefund(params: {
  ledgerTotalMinor: number;
  chargedMinor: number;
  refundedLedgerMinor: number;
  refundedTaxMinor: number;
  requestedLedgerMinor: number;
}): TaxInclusiveRefundPlan {
  const ledgerTotal = Math.max(0, Math.round(params.ledgerTotalMinor));
  const charged = Math.max(0, Math.round(params.chargedMinor));
  const taxTotal = Math.max(0, charged - ledgerTotal);
  const ledgerLeft = Math.max(
    0,
    ledgerTotal - Math.max(0, Math.round(params.refundedLedgerMinor))
  );
  const taxLeft = Math.max(
    0,
    taxTotal - Math.max(0, Math.round(params.refundedTaxMinor))
  );
  const ledgerMinor = Math.min(
    Math.max(0, Math.round(params.requestedLedgerMinor)),
    ledgerLeft
  );
  if (ledgerMinor <= 0 || taxTotal <= 0) {
    return { ledgerMinor, taxMinor: 0, cardMinor: ledgerMinor };
  }
  const taxMinor =
    ledgerMinor >= ledgerLeft
      ? taxLeft
      : Math.min(taxLeft, Math.round((ledgerMinor * taxTotal) / ledgerTotal));
  return { ledgerMinor, taxMinor, cardMinor: ledgerMinor + taxMinor };
}

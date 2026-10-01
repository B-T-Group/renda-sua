import { collectedDeliveryFee } from './delivery-pricing.util';

/**
 * Percentage-of-items fees (client cancellation fee, client-fault failed delivery fee).
 *
 * Single definition of the fee base, mirrored 1:1 by the Python cancellation lambda
 * (`rendasua_core_packages/utilities/cancellation_fee.py`). Keep both in sync; both
 * have a shared table of test vectors.
 *
 * NOTE: this file is intentionally identical on every branch that uses it so the
 * branches merge cleanly in any order.
 */

/** Used only when no config row exists at all (always logged as an error). */
export const DEFAULT_FEE_PERCENT = 30;

/** Currencies without minor units (round to whole units). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'XAF',
  'XOF',
  'JPY',
  'KRW',
  'VND',
  'CLP',
  'UGX',
  'RWF',
  'BIF',
  'DJF',
  'KMF',
  'GNF',
  'PYG',
  'VUV',
  'XPF',
]);

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  CAMEROON: 'CM',
  CAMEROUN: 'CM',
  GABON: 'GA',
  CANADA: 'CA',
  TOGO: 'TG',
  BENIN: 'BJ',
  'BÉNIN': 'BJ',
  "COTE D'IVOIRE": 'CI',
  "CÔTE D'IVOIRE": 'CI',
  'IVORY COAST': 'CI',
  CONGO: 'CG',
  PHILIPPINES: 'PH',
  'UNITED STATES': 'US',
  USA: 'US',
};

export interface FeeBaseOrder {
  total_amount?: number | string | null;
  base_delivery_fee?: number | string | null;
  per_km_delivery_fee?: number | string | null;
  delivery_fee_waived?: boolean | null;
  tax_amount?: number | string | null;
}

export function currencyDecimals(currency: string | null | undefined): number {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency ?? '').toUpperCase())
    ? 0
    : 2;
}

/** ISO-3166 alpha-2 code from a code or a known country name; null when unknown. */
export function normalizeFeeCountryCode(
  country: string | null | undefined
): string | null {
  const raw = String(country ?? '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.length === 2) return raw;
  return COUNTRY_NAME_TO_CODE[raw] ?? null;
}

/**
 * Item subtotal AFTER discounts, excluding delivery fee and tax:
 *   max(0, total_amount - collected_delivery_fee - tax_amount)
 *
 * `total_amount` is what the client is actually charged (items + delivery + tax - discount
 * code - purchase credits), so every discount is already netted out. The delivery fee is the
 * fee the customer actually paid (0 when waived). This equals the pay-now `client_hold_amount`
 * (item portion of the hold) used by the lambda.
 */
export function itemSubtotalAfterDiscounts(order: FeeBaseOrder): number {
  const total = Number(order.total_amount ?? 0);
  const tax = Number(order.tax_amount ?? 0);
  const base = total - collectedDeliveryFee(order) - tax;
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.round(base * 100) / 100;
}

/**
 * `percent`% of `base`, rounded half-up to the currency's minor unit
 * (XAF/XOF whole units, others 2 decimals).
 */
export function percentFee(
  base: number,
  percent: number,
  currency: string | null | undefined
): number {
  if (!(base > 0) || !(percent > 0)) return 0;
  const factor = 10 ** currencyDecimals(currency);
  const baseMinor = Math.round(base * factor);
  // percent in basis points (2 decimals) keeps the product an exact integer, so the
  // half-up rounding below is deterministic and identical to the Python Decimal version.
  const basisPoints = Math.round(percent * 100);
  const feeMinor = Math.floor((baseMinor * basisPoints + 5000) / 10000);
  return feeMinor / factor;
}

export interface FeePercentRow {
  country_code?: string | null;
  number_value?: number | string | null;
}

export type FeePercentSource = 'country' | 'global' | 'missing_default';

export interface ResolvedFeePercent {
  percent: number;
  source: FeePercentSource;
}

function validPercent(value: unknown, where: string): number {
  const n = Number(value);
  if (value == null || value === '' || !Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error(`Invalid fee percent (${String(value)}) for ${where}: expected 0-100`);
  }
  return n;
}

/**
 * Pick the percent from `application_configurations` rows (already filtered to the key,
 * status=active and country in [country, NULL]).
 *   1. row for the country (an explicit 0 is honoured: Canada),
 *   2. else the global row (country_code NULL),
 *   3. else `missing_default` = DEFAULT_FEE_PERCENT. The caller MUST log this at error
 *      level (never a silent 0 and never a silent default).
 * An existing row with a NULL / out-of-range value throws (fail loud, never waive).
 */
export function selectFeePercent(
  rows: FeePercentRow[],
  countryCode: string | null
): ResolvedFeePercent {
  const country = countryCode?.toUpperCase() ?? null;
  const countryRow = country
    ? rows.find((r) => String(r.country_code ?? '').toUpperCase() === country)
    : undefined;
  if (countryRow) {
    return {
      percent: validPercent(countryRow.number_value, `country ${country}`),
      source: 'country',
    };
  }
  const globalRow = rows.find((r) => r.country_code == null || r.country_code === '');
  if (globalRow) {
    return {
      percent: validPercent(globalRow.number_value, 'global default'),
      source: 'global',
    };
  }
  return { percent: DEFAULT_FEE_PERCENT, source: 'missing_default' };
}

export interface FeeConfigRunner {
  executeQuery(query: string, variables?: Record<string, any>): Promise<any>;
}
export interface FeeLogger {
  warn(message: string): void;
  error(message: string): void;
}

const feePercentRowsQuery = (withCountry: boolean): string => `
  query FeePercentRows($key: String!${withCountry ? ', $country: String!' : ''}) {
    application_configurations(
      where: {
        config_key: { _eq: $key }
        status: { _eq: "active" }
        _or: [
          ${withCountry ? '{ country_code: { _eq: $country } }' : ''}
          { country_code: { _is_null: true } }
        ]
      }
    ) {
      country_code
      number_value
    }
  }
`;

/**
 * Resolve a percent-of-items fee from `application_configurations`.
 *  - country row wins (explicit 0 = free, e.g. CA), then a NULL-country global row;
 *  - nothing configured => DEFAULT_FEE_PERCENT and an ERROR log with `missingMarker`
 *    (never a silent 0 and never a silent default);
 *  - a Hasura read error is NOT swallowed (callers must fail the step, not waive the fee).
 */
export async function resolveFeePercent(
  hasura: FeeConfigRunner,
  configKey: string,
  country: string | null,
  logger: FeeLogger,
  missingMarker: string,
  context: string
): Promise<ResolvedFeePercent> {
  if (!country) {
    logger.error(
      `fee_country_unknown key=${configKey} ${context}: business location country is missing/unrecognised; using global row or default ${DEFAULT_FEE_PERCENT}%`
    );
  }
  const data = await hasura.executeQuery(
    feePercentRowsQuery(!!country),
    country ? { key: configKey, country } : { key: configKey }
  );
  const rows: FeePercentRow[] = data?.application_configurations ?? [];
  const resolved = selectFeePercent(rows, country);
  if (resolved.source === 'missing_default') {
    logger.error(
      `${missingMarker} key=${configKey} country=${country ?? 'unknown'} ${context}: no active config row; using default ${DEFAULT_FEE_PERCENT}%`
    );
  }
  return resolved;
}

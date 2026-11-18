import { countryKeys } from '../orders/delivery-pricing.util';
import { resolveItemCountry } from '../mobile-payments/item-country.util';

export interface DashboardRequestFlagRow {
  boolean_value: boolean | null;
  country_code: string | null;
}

/** Country row wins, after the address is normalized to an ISO code. */
export function listingDashboardFlag(
  rows: DashboardRequestFlagRow[],
  rawCountry?: string | null
): boolean {
  return dashboardRequestsEnabled(rows, resolveItemCountry(rawCountry));
}

/** Country row wins. Otherwise the global row. Missing rows stay off. */
export function dashboardRequestsEnabled(
  rows: DashboardRequestFlagRow[],
  country?: string | null
): boolean {
  const code = (country ?? '').trim().toUpperCase();
  if (code) {
    const countryRow = rows.find((row) => (row.country_code ?? '').toUpperCase() === code);
    if (countryRow?.boolean_value != null) return countryRow.boolean_value === true;
  }
  const globalRow = rows.find((row) => row.country_code == null);
  return globalRow?.boolean_value === true;
}

export type ExpiryCountryFilter =
  | { kind: 'none' }
  | { kind: 'all' }
  | { kind: 'in'; countries: string[] }
  | { kind: 'out'; countries: string[] };

/** Countries the expiry scan may read. Applied in SQL before the batch limit. */
export function expiryCountryFilter(rows: DashboardRequestFlagRow[]): ExpiryCountryFilter {
  const globalOn = rows.find((row) => row.country_code == null)?.boolean_value === true;
  const on = rows.filter((row) => row.country_code && row.boolean_value === true);
  const off = rows.filter((row) => row.country_code && row.boolean_value === false);
  if (!globalOn && on.length === 0) return { kind: 'none' };
  if (globalOn && off.length === 0) return { kind: 'all' };
  if (globalOn) return { kind: 'out', countries: spellings(off) };
  return { kind: 'in', countries: spellings(on) };
}

function spellings(rows: DashboardRequestFlagRow[]): string[] {
  return [...new Set(rows.flatMap((row) => countryKeys(row.country_code ?? '')))];
}

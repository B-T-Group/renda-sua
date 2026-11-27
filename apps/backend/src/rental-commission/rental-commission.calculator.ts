import { currencyDecimals } from '../orders/fee-percent.util';

export const COMMISSION_CALC_VERSION = 1;
export const COMMISSION_BASIS = 'rental_subtotal';
export const COMMISSION_ROUNDING = 'half_up_minor_unit';
export const MAX_RATE_BPS = 10000;

export interface CommissionSplit {
  rateBps: number;
  baseAmount: number;
  commissionAmount: number;
  merchantPayoutAmount: number;
}

export function assertRateBps(rateBps: number): void {
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > MAX_RATE_BPS) {
    throw new Error(`Invalid commission rate (${rateBps}): expected whole basis points 0-${MAX_RATE_BPS}`);
  }
}

/** Decimal string to integer minor units. Never multiplies a float. */
export function toMinorUnits(amount: number | string, currency: string | null | undefined): bigint {
  const decimals = currencyDecimals(currency);
  const fixed = Number(amount).toFixed(decimals);
  if (!Number.isFinite(Number(fixed))) throw new Error(`Invalid amount: ${String(amount)}`);
  const negative = fixed.startsWith('-');
  const digits = fixed.replace('-', '').replace('.', '');
  const minor = BigInt(digits);
  return negative ? -minor : minor;
}

export function fromMinorUnits(minor: bigint, currency: string | null | undefined): number {
  const decimals = currencyDecimals(currency);
  const negative = minor < 0n;
  const padded = (negative ? -minor : minor).toString().padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals);
  const text = `${negative ? '-' : ''}${whole}${decimals > 0 ? `.${fraction}` : ''}`;
  return Number(text);
}

/** floor((base * rate + 5000) / 10000): half-up on integer minor units. */
export function commissionMinor(baseMinor: bigint, rateBps: number): bigint {
  assertRateBps(rateBps);
  if (baseMinor <= 0n) return 0n;
  return (baseMinor * BigInt(rateBps) + 5000n) / 10000n;
}

/**
 * The only place a rental commission is computed. Commission plus merchant payout always equals
 * the base, and the commission never exceeds it.
 */
export function calculateRentalCommission(
  base: number | string,
  rateBps: number,
  currency: string | null | undefined
): CommissionSplit {
  const baseMinor = toMinorUnits(base, currency);
  const safeBase = baseMinor > 0n ? baseMinor : 0n;
  const commission = commissionMinor(safeBase, rateBps);
  return {
    rateBps,
    baseAmount: fromMinorUnits(safeBase, currency),
    commissionAmount: fromMinorUnits(commission, currency),
    merchantPayoutAmount: fromMinorUnits(safeBase - commission, currency),
  };
}

export function ratePercentLabel(rateBps: number): string {
  const percent = rateBps / 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/0+$/, '');
}

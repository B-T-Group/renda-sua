/**
 * Count formatting for the market picker.
 * Exact below 10,000 with locale separators, compact from 10,000 (12.4k / 12,4 k).
 * Hand-rolled (no Intl compact notation) so Hermes on every device renders the same text.
 */

const NARROW_NBSP = '\u202f';
const NBSP = '\u00a0';
const COMPACT_FROM = 10_000;

export function isFrenchLocale(language: string | undefined | null): boolean {
  return (language ?? '').toLowerCase().startsWith('fr');
}

function groupThousands(value: number, separator: string): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function compact(value: number, french: boolean): string {
  const [divisor, unit] = value >= 1_000_000 ? [1_000_000, 'M'] : [1_000, 'k'];
  // Truncate (never round up) so 99,950 reads 99.9k, not a misleading 100k.
  const scaled = Math.floor((value / divisor) * 10) / 10;
  const text = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
  if (french) return `${text.replace('.', ',')}${NBSP}${unit}`;
  return `${text}${unit}`;
}

export function formatMarketCount(
  value: number,
  language: string | undefined | null
): string {
  const n = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  const french = isFrenchLocale(language);
  if (n >= COMPACT_FROM) return compact(n, french);
  return groupThousands(n, french ? NARROW_NBSP : ',');
}

/** Exact value with separators (used for screen-reader labels, never compacted). */
export function formatMarketCountExact(
  value: number,
  language: string | undefined | null
): string {
  const n = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return groupThousands(n, isFrenchLocale(language) ? NARROW_NBSP : ',');
}

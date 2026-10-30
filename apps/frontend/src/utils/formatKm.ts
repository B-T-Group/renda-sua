/** Coerce API/order/offer km (Hasura numeric is often a string) to a finite number. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Format a km value from API/order/offer data.
 * Returns null when the value is missing or not finite so callers can
 * fall back to an em dash or omit the label.
 */
export function formatKm(value: unknown, decimals = 1): string | null {
  const n = toFiniteNumber(value);
  return n == null ? null : n.toFixed(decimals);
}

/** ` · 2.5 km` or empty when the value cannot be formatted. */
export function formatKmSuffix(value: unknown): string {
  const label = formatKm(value);
  return label == null ? '' : ` · ${label} km`;
}

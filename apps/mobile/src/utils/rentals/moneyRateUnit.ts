const NBSP = '\u00A0';

/** Drop a leading "/ " so callers can pass `day`, `/ day`, or `/jour`. */
export function rateUnitLabel(unit: string): string {
  return unit.replace(/^\s*\/\s*/, '').trim();
}

/**
 * Join an amount and unit with non-breaking spaces around the slash,
 * e.g. `15 000 FCFA / day`, `3 000 FCFA / h`.
 */
export function withRateUnit(amount: string, unit: string): string {
  return `${amount}${NBSP}/${NBSP}${rateUnitLabel(unit)}`;
}

/** The suffix alone, when the amount is already on the screen. */
export function rateUnitSuffix(unit: string): string {
  return `${NBSP}/${NBSP}${rateUnitLabel(unit)}`;
}

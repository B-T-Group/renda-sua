import type { CheckoutBlocker, ResolvedCheckoutConfig } from '../types/checkout';

/** First blocking error when preflight resolved and checkout cannot proceed. */
export function checkoutPreflightBlocker(
  config: ResolvedCheckoutConfig | null | undefined,
  loading: boolean
): CheckoutBlocker | null {
  if (loading || !config) return null;
  if (config.can_proceed) return null;
  return config.blocking_errors[0] ?? null;
}

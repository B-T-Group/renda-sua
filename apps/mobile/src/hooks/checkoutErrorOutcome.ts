import type { CheckoutOutcome } from './useCheckoutOrchestrator';

/** Thrown API errors keep their code (e.g. DELIVERY_UNAVAILABLE) so screens can react. */
export function errorOutcomeFromThrown(e: unknown): CheckoutOutcome {
  const message = e instanceof Error ? e.message : 'Failed to place order.';
  const code = (e as { code?: unknown } | null)?.code;
  return { type: 'error', message, ...(typeof code === 'string' && code ? { code } : {}) };
}

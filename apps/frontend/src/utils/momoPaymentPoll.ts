export type MomoPaymentPollPhase = 'waiting' | 'paid' | 'failed';

/** Aggregate payment_status values from one or more orders. */
export function resolveMomoPaymentStatuses(
  statuses: Array<string | null | undefined>
): MomoPaymentPollPhase {
  if (statuses.length === 0) return 'waiting';
  if (statuses.some((status) => status === 'failed')) return 'failed';
  if (statuses.every((status) => status === 'paid')) return 'paid';
  return 'waiting';
}

export const MOMO_POLL_INTERVAL_MS = 5000;
export const MOMO_POLL_TIMEOUT_MS = 3 * 60 * 1000;

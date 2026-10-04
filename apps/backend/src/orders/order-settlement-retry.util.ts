export type SettlementStage = 'item' | 'delivery';

/** After this many failed attempts the short wave ends and a daily cooldown starts. */
export const SETTLEMENT_RETRY_MAX_ATTEMPTS = 8;

/** How long a claimed retry is leased so two instances never run the same hold. */
export const SETTLEMENT_RETRY_LEASE_MINUTES = 15;

/** After the short wave, keep trying once a day so a later code fix can settle leftovers. */
export const SETTLEMENT_RETRY_EXHAUSTED_COOLDOWN_MINUTES = 24 * 60;

/** Exponential backoff in minutes: 5, 10, 20, 40, 80, 160, 320 (capped at 6 h). */
export function settlementRetryDelayMinutes(failedAttempts: number): number {
  const exp = Math.max(0, failedAttempts - 1);
  return Math.min(5 * 2 ** exp, 360);
}

export function isSettlementRetryExhausted(failedAttempts: number): boolean {
  return failedAttempts >= SETTLEMENT_RETRY_MAX_ATTEMPTS;
}

export function justExhaustedSettlementRetry(
  previousCount: number,
  failedAttempts: number
): boolean {
  return (
    previousCount < SETTLEMENT_RETRY_MAX_ATTEMPTS &&
    isSettlementRetryExhausted(failedAttempts)
  );
}

export function nextSettlementRetryDelayMinutes(failedAttempts: number): number {
  return isSettlementRetryExhausted(failedAttempts)
    ? SETTLEMENT_RETRY_EXHAUSTED_COOLDOWN_MINUTES
    : settlementRetryDelayMinutes(failedAttempts);
}

export function nextSettlementRetryAtIso(
  failedAttempts: number,
  now: Date = new Date()
): string {
  return new Date(
    now.getTime() + nextSettlementRetryDelayMinutes(failedAttempts) * 60_000
  ).toISOString();
}

/**
 * How long a per-stage settlement claim (order_holds.*_settlement_claimed_at) is honoured
 * before it is treated as abandoned. Ledger moves are idempotency-keyed, so a re-claim after
 * expiry cannot double-pay.
 */
export const SETTLEMENT_CLAIM_LEASE_MINUTES = 15;

/**
 * Statuses a queued settlement retry may run in besides the stage's normal gate statuses:
 * the order has moved on (delivered/complete) but was NOT cancelled, failed or refunded.
 * Anything else (cancelled, failed, refunded, refund_approved_*, pending, confirmed, ...)
 * is refused and the retry row is cleared with an alert (UAT S-5).
 */
export const RETRY_SETTLEABLE_STATUSES: string[] = [
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'shipped',
  'in_delivery',
  'complete',
  'refund_requested',
  'refund_rejected',
];

export type SettlementStage = 'item' | 'delivery';

/** After this many failed attempts automatic retries stop and an alert is raised. */
export const SETTLEMENT_RETRY_MAX_ATTEMPTS = 8;

/** How long a claimed retry is leased so two instances never run the same hold. */
export const SETTLEMENT_RETRY_LEASE_MINUTES = 15;

/** Exponential backoff in minutes: 5, 10, 20, 40, 80, 160, 320 (capped at 6 h). */
export function settlementRetryDelayMinutes(failedAttempts: number): number {
  const exp = Math.max(0, failedAttempts - 1);
  return Math.min(5 * 2 ** exp, 360);
}

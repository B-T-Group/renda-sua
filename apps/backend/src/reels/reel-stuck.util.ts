/** Processing statuses that mean the reel is still in the pipeline. */
export const REEL_IN_PROGRESS_STATUSES = new Set([
  'generating',
  'queued',
  'processing',
  'awaiting_upload',
]);

/** Statuses that can be force-retried when stuck (need source media). */
export const REEL_RETRYABLE_STUCK_STATUSES = new Set([
  'queued',
  'processing',
]);

export const DEFAULT_REEL_STUCK_AFTER_MINUTES = 15;

export function reelAgeMs(
  updatedAt?: string | null,
  nowMs = Date.now()
): number | null {
  if (!updatedAt) return null;
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated)) return null;
  return Math.max(0, nowMs - updated);
}

export function isReelStuckInProgress(params: {
  processingStatus?: string | null;
  updatedAt?: string | null;
  stuckAfterMinutes?: number;
  nowMs?: number;
}): boolean {
  const status = params.processingStatus || '';
  if (!REEL_IN_PROGRESS_STATUSES.has(status)) return false;
  const age = reelAgeMs(params.updatedAt, params.nowMs ?? Date.now());
  if (age == null) return false;
  const mins =
    params.stuckAfterMinutes ?? DEFAULT_REEL_STUCK_AFTER_MINUTES;
  return age >= mins * 60_000;
}

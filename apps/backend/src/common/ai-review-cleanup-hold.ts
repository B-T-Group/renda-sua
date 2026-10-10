/** Matches cleanup DLQ stale window so a live worker is not swept mid-flight. */
export const CLEANUP_PROCESSING_HOLD_MS = 30 * 60 * 1000;
/** Merchant photo review should not pin AI moderation forever. */
export const CLEANUP_PHOTO_REVIEW_HOLD_MS = 24 * 60 * 60 * 1000;

export function cleanupJobBlocksAiReviewSweep(
  job: { status: string; updated_at?: string | null },
  nowMs: number
): boolean {
  const updated = job.updated_at ? Date.parse(job.updated_at) : NaN;
  const age = nowMs - (Number.isFinite(updated) ? updated : 0);
  if (job.status === 'queued' || job.status === 'processing') {
    return age < CLEANUP_PROCESSING_HOLD_MS;
  }
  if (job.status === 'ready_for_review') {
    return age < CLEANUP_PHOTO_REVIEW_HOLD_MS;
  }
  return false;
}

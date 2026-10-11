import {
  CLEANUP_PHOTO_REVIEW_HOLD_MS,
  CLEANUP_PROCESSING_HOLD_MS,
  cleanupJobBlocksAiReviewSweep,
} from './ai-review-cleanup-hold';

describe('cleanupJobBlocksAiReviewSweep', () => {
  const now = Date.now();

  it('holds a fresh processing job', () => {
    expect(
      cleanupJobBlocksAiReviewSweep(
        { status: 'processing', updated_at: new Date(now).toISOString() },
        now
      )
    ).toBe(true);
  });

  it('releases a processing job older than the exhaustion window', () => {
    const updated = new Date(
      now - CLEANUP_PROCESSING_HOLD_MS - 1000
    ).toISOString();
    expect(
      cleanupJobBlocksAiReviewSweep(
        { status: 'queued', updated_at: updated },
        now
      )
    ).toBe(false);
  });

  it('holds a photo review for a day, then releases it', () => {
    const fresh = new Date(now - 60 * 60 * 1000).toISOString();
    const stale = new Date(
      now - CLEANUP_PHOTO_REVIEW_HOLD_MS - 1000
    ).toISOString();
    expect(
      cleanupJobBlocksAiReviewSweep(
        { status: 'ready_for_review', updated_at: fresh },
        now
      )
    ).toBe(true);
    expect(
      cleanupJobBlocksAiReviewSweep(
        { status: 'ready_for_review', updated_at: stale },
        now
      )
    ).toBe(false);
  });

  it('releases a live job at the exact hold and ignores a missing timestamp', () => {
    const exact = new Date(now - CLEANUP_PROCESSING_HOLD_MS).toISOString();
    const stillHeld = new Date(
      now - CLEANUP_PROCESSING_HOLD_MS + 1
    ).toISOString();
    expect(
      cleanupJobBlocksAiReviewSweep(
        { status: 'processing', updated_at: exact },
        now
      )
    ).toBe(false);
    expect(
      cleanupJobBlocksAiReviewSweep(
        { status: 'queued', updated_at: stillHeld },
        now
      )
    ).toBe(true);
    expect(
      cleanupJobBlocksAiReviewSweep({ status: 'queued', updated_at: null }, now)
    ).toBe(false);
    expect(
      cleanupJobBlocksAiReviewSweep(
        { status: 'failed', updated_at: new Date(now).toISOString() },
        now
      )
    ).toBe(false);
  });
});

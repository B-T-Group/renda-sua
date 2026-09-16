import {
  DEFAULT_REEL_STUCK_AFTER_MINUTES,
  isReelStuckInProgress,
  REEL_RETRYABLE_STUCK_STATUSES,
} from './reel-stuck.util';

describe('reel-stuck.util', () => {
  const now = Date.parse('2026-09-16T12:00:00.000Z');

  it('detects stuck in-progress after the threshold', () => {
    expect(
      isReelStuckInProgress({
        processingStatus: 'processing',
        updatedAt: '2026-09-16T11:40:00.000Z',
        stuckAfterMinutes: DEFAULT_REEL_STUCK_AFTER_MINUTES,
        nowMs: now,
      })
    ).toBe(true);
  });

  it('does not treat recent processing as stuck', () => {
    expect(
      isReelStuckInProgress({
        processingStatus: 'queued',
        updatedAt: '2026-09-16T11:50:00.000Z',
        stuckAfterMinutes: 15,
        nowMs: now,
      })
    ).toBe(false);
  });

  it('ignores ready and failed statuses', () => {
    expect(
      isReelStuckInProgress({
        processingStatus: 'failed',
        updatedAt: '2026-09-16T10:00:00.000Z',
        nowMs: now,
      })
    ).toBe(false);
  });

  it('lists retryable stuck statuses', () => {
    expect(REEL_RETRYABLE_STUCK_STATUSES.has('queued')).toBe(true);
    expect(REEL_RETRYABLE_STUCK_STATUSES.has('generating')).toBe(false);
  });
});

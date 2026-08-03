import {
  stripRedundantCleanupRecommendations,
} from './strip-redundant-cleanup-recommendations';
import type { AiReviewModelResult } from './item-ai-review.types';

describe('stripRedundantCleanupRecommendations', () => {
  const base: AiReviewModelResult = {
    decision: 'propose',
    reason:
      'Photos need improvement. Upload higher-quality images or use AI photo cleanup where recommended.',
    issues: [],
    proposedTitle: 'Better title',
    proposedDescription: null,
    imageActions: [
      { imageId: 'img-1', action: 'cleanup', note: 'clutter' },
      { imageId: 'img-2', action: 'keep' },
    ],
  };

  it('strips cleanup when a job is already open', () => {
    const out = stripRedundantCleanupRecommendations(base, {
      cleanupJobOpen: true,
      cleanedImageIds: new Set(),
    });
    expect(out.imageActions.every((a) => a.action !== 'cleanup')).toBe(true);
    expect(out.imageActions[0].action).toBe('keep');
    expect(out.reason).not.toMatch(/AI photo cleanup/i);
  });

  it('strips cleanup only for already-cleaned images', () => {
    const out = stripRedundantCleanupRecommendations(base, {
      cleanupJobOpen: false,
      cleanedImageIds: new Set(['img-1']),
    });
    expect(out.imageActions[0].action).toBe('keep');
    expect(out.imageActions[1].action).toBe('keep');
  });

  it('leaves cleanup when nothing is queued or cleaned', () => {
    const out = stripRedundantCleanupRecommendations(base, {
      cleanupJobOpen: false,
      cleanedImageIds: new Set(),
    });
    expect(out.imageActions[0].action).toBe('cleanup');
    expect(out.reason).toContain('AI photo cleanup');
  });
});

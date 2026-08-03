import {
  buildApplyPatch,
  buildRevertPatch,
  shouldSkipAutoApply,
} from './image-versioning.helpers';

describe('image versioning helpers', () => {
  it('skips auto-apply when merchant already reverted', () => {
    expect(
      shouldSkipAutoApply({
        revertedAt: '2026-01-01T00:00:00Z',
        liveS3Key: 'a',
        activeVersion: 'original',
        expectedOriginalKey: 'a',
      })
    ).toBe(true);
  });

  it('skips auto-apply when source image was replaced', () => {
    expect(
      shouldSkipAutoApply({
        revertedAt: null,
        liveS3Key: 'new-key',
        activeVersion: 'original',
        expectedOriginalKey: 'old-key',
      })
    ).toBe(true);
  });

  it('allows apply when keys match', () => {
    expect(
      shouldSkipAutoApply({
        revertedAt: null,
        liveS3Key: 'same',
        activeVersion: 'original',
        expectedOriginalKey: 'same',
      })
    ).toBe(false);
  });

  it('builds apply patch preserving original pointers and content hash', () => {
    const patch = buildApplyPatch({
      result: {
        cleaned_image_url: 'https://cdn/enhanced.png',
        cleaned_s3_key: 'enhanced-key',
        original_image_url: 'https://cdn/orig.png',
        original_s3_key: 'orig-key',
      },
      row: {
        original_image_url: null,
        original_s3_key: null,
        s3_key: 'orig-key',
        content_hash: 'abc123',
      },
      now: '2026-08-03T12:00:00Z',
    });
    expect(patch.original_image_url).toBe('https://cdn/orig.png');
    expect(patch.original_s3_key).toBe('orig-key');
    expect(patch.image_url).toBe('https://cdn/enhanced.png');
    expect(patch.active_version).toBe('enhanced');
    expect(patch.reverted_at).toBeNull();
    expect(patch.content_hash).toBe('abc123');
  });

  it('builds revert patch back to original', () => {
    const patch = buildRevertPatch({
      originalUrl: 'https://cdn/orig.png',
      originalKey: 'orig-key',
      now: '2026-08-03T12:00:00Z',
    });
    expect(patch.active_version).toBe('original');
    expect(patch.is_ai_cleaned).toBe(false);
    expect(patch.image_url).toBe('https://cdn/orig.png');
  });
});

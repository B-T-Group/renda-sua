import {
  buildApplyPatch,
  buildRevertPatch,
  buildSelectVersionPatch,
  hasExistingVersion,
  omitUnsupportedVariantImageFields,
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

  it('builds AI apply patch preserving original pointers and content hash', () => {
    const patch = buildApplyPatch({
      result: {
        cleaned_image_url: 'https://cdn/enhanced.png',
        cleaned_s3_key: 'enhanced-key',
        original_image_url: 'https://cdn/orig.png',
        original_s3_key: 'orig-key',
        kind: 'ai',
      },
      row: {
        original_image_url: null,
        original_s3_key: null,
        s3_key: 'orig-key',
        content_hash: 'abc123',
        validation_warnings: [
          { code: 'LOW_RESOLUTION', message: 'too small', severity: 'warning' },
          {
            code: 'CLUTTERED_BACKGROUND',
            message: 'busy',
            severity: 'warning',
          },
        ],
        validation_errors: [],
      },
      now: '2026-08-03T12:00:00Z',
    });
    expect(patch.original_image_url).toBe('https://cdn/orig.png');
    expect(patch.original_s3_key).toBe('orig-key');
    expect(patch.image_url).toBe('https://cdn/enhanced.png');
    expect(patch.active_version).toBe('enhanced');
    expect(patch.is_ai_cleaned).toBe(true);
    expect(patch.reverted_at).toBeNull();
    expect(patch.content_hash).toBe('abc123');
    expect(patch.width).toBe(1024);
    expect(patch.height).toBe(1024);
    expect(patch.validation_warnings).toEqual([
      {
        code: 'CLUTTERED_BACKGROUND',
        message: 'busy',
        severity: 'warning',
      },
    ]);
    expect(patch.quality_score).toBe(90);
  });

  it('builds rembg apply patch without touching enhanced columns', () => {
    const patch = buildApplyPatch({
      result: {
        cleaned_image_url: 'https://cdn/rembg.png',
        cleaned_s3_key: 'rembg-key',
        original_image_url: 'https://cdn/orig.png',
        original_s3_key: 'orig-key',
        kind: 'rembg',
      },
      row: {
        original_image_url: 'https://cdn/orig.png',
        original_s3_key: 'orig-key',
        s3_key: 'orig-key',
      },
      now: '2026-08-14T12:00:00Z',
      kind: 'rembg',
    });
    expect(patch.active_version).toBe('rembg');
    expect(patch.is_rembg_cleaned).toBe(true);
    expect(patch.rembg_image_url).toBe('https://cdn/rembg.png');
    expect(patch.image_url).toBe('https://cdn/rembg.png');
    expect((patch as { is_ai_cleaned?: boolean }).is_ai_cleaned).toBeUndefined();
    expect((patch as { width?: number }).width).toBeUndefined();
    expect((patch as { height?: number }).height).toBeUndefined();
  });

  it('builds revert patch without clearing existence flags', () => {
    const patch = buildRevertPatch({
      originalUrl: 'https://cdn/orig.png',
      originalKey: 'orig-key',
      now: '2026-08-03T12:00:00Z',
    });
    expect(patch.active_version).toBe('original');
    expect(patch.image_url).toBe('https://cdn/orig.png');
    expect((patch as { is_ai_cleaned?: boolean }).is_ai_cleaned).toBeUndefined();
  });

  it('selects rembg / enhanced / original versions', () => {
    expect(
      buildSelectVersionPatch({
        version: 'rembg',
        originalUrl: 'o',
        originalKey: 'ok',
        rembgUrl: 'r',
        rembgKey: 'rk',
        enhancedUrl: 'e',
        enhancedKey: 'ek',
      }).active_version
    ).toBe('rembg');
    expect(
      buildSelectVersionPatch({
        version: 'enhanced',
        originalUrl: 'o',
        originalKey: 'ok',
        rembgUrl: 'r',
        rembgKey: 'rk',
        enhancedUrl: 'e',
        enhancedKey: 'ek',
      }).active_version
    ).toBe('enhanced');
    expect(
      buildSelectVersionPatch({
        version: 'original',
        originalUrl: 'o',
        originalKey: 'ok',
        rembgUrl: 'r',
        rembgKey: 'rk',
        enhancedUrl: 'e',
        enhancedKey: 'ek',
      }).active_version
    ).toBe('original');
  });

  it('strips width and validation fields from variant image patches', () => {
    const patch = omitUnsupportedVariantImageFields({
      image_url: 'https://cdn/enhanced.png',
      s3_key: 'enhanced-key',
      width: 1024,
      height: 1024,
      validation_warnings: [],
      validation_errors: [],
      quality_score: 90,
      validated_at: '2026-08-20T00:00:00Z',
      content_hash: 'abc123',
    });
    expect(patch).toEqual({
      image_url: 'https://cdn/enhanced.png',
      s3_key: 'enhanced-key',
      content_hash: 'abc123',
    });
  });

  it('detects existing versions by flag or URL', () => {
    expect(hasExistingVersion({ is_ai_cleaned: true }, 'ai')).toBe(true);
    expect(
      hasExistingVersion({ enhanced_image_url: 'https://x' }, 'ai')
    ).toBe(true);
    expect(hasExistingVersion({ is_rembg_cleaned: true }, 'rembg')).toBe(true);
    expect(hasExistingVersion({}, 'rembg')).toBe(false);
  });
});

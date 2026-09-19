import {
  checkReelUploadDuration,
  MAX_SOURCE_UPLOAD_MS,
  MIN_UPLOAD_MS,
  normalizePickerDurationMs,
  TARGET_UPLOAD_MS,
} from './reelUploadDuration';

describe('reelUploadDuration', () => {
  it('normalizes seconds and milliseconds from the picker', () => {
    expect(normalizePickerDurationMs(25)).toBe(25_000);
    expect(normalizePickerDurationMs(25_000)).toBe(25_000);
    expect(normalizePickerDurationMs(0)).toBe(0);
    expect(normalizePickerDurationMs(undefined)).toBe(0);
  });

  it('rejects clips shorter than 15s', () => {
    expect(checkReelUploadDuration(MIN_UPLOAD_MS - 1)).toEqual({
      ok: false,
      reason: 'tooShort',
    });
  });

  it('allows 15–30s clips', () => {
    expect(checkReelUploadDuration(MIN_UPLOAD_MS)).toEqual({ ok: true });
    expect(checkReelUploadDuration(TARGET_UPLOAD_MS)).toEqual({ ok: true });
  });

  it('allows clips over 30s up to 2 minutes (server will trim)', () => {
    expect(checkReelUploadDuration(TARGET_UPLOAD_MS + 1)).toEqual({ ok: true });
    expect(checkReelUploadDuration(MAX_SOURCE_UPLOAD_MS)).toEqual({ ok: true });
  });

  it('rejects clips longer than 2 minutes', () => {
    expect(checkReelUploadDuration(MAX_SOURCE_UPLOAD_MS + 1)).toEqual({
      ok: false,
      reason: 'tooLong',
    });
  });
});

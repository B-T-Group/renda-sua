/** Merchant library uploads: min length; Lambda trims output to 30s. */
export const MIN_UPLOAD_MS = 15_000;
/** Soft product length; longer clips are trimmed server-side to this. */
export const TARGET_UPLOAD_MS = 30_000;
/** Hard client cap so huge files never hit the media worker. */
export const MAX_SOURCE_UPLOAD_MS = 120_000;

export type ReelUploadDurationCheck =
  | { ok: true }
  | { ok: false; reason: 'tooShort' | 'tooLong' };

export function checkReelUploadDuration(durationMs: number): ReelUploadDurationCheck {
  if (durationMs < MIN_UPLOAD_MS) {
    return { ok: false, reason: 'tooShort' };
  }
  if (durationMs > MAX_SOURCE_UPLOAD_MS) {
    return { ok: false, reason: 'tooLong' };
  }
  return { ok: true };
}

/** Normalize ImagePicker duration (seconds or ms) to milliseconds. */
export function normalizePickerDurationMs(duration: number | undefined | null): number {
  if (duration == null || duration <= 0) return 0;
  return duration < 1000 ? Math.round(duration * 1000) : Math.round(duration);
}

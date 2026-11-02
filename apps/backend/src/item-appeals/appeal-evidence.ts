import { HttpException, HttpStatus } from '@nestjs/common';
import { RECOVERY_ERRORS } from './item-recovery.constants';

/** Appeal evidence photos: private bucket, key-only storage, presigned access. */
export const APPEAL_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const APPEAL_EVIDENCE_URL_TTL_SECONDS = 600;
/** Raster only: SVG (scriptable) and anything else is refused. */
export const APPEAL_EVIDENCE_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const EXTENSIONS = new Set(Object.values(APPEAL_EVIDENCE_TYPES));

/**
 * Evidence is private: it lives in the private user-uploads bucket (the one ID
 * documents use, served only via presigned GETs) — never in the public
 * rendasua-uploads bucket, whose items/* and businesses/* objects are anonymously
 * readable. We store the S3 key only and hand out short-lived presigned GETs.
 */
export const APPEAL_EVIDENCE_DEFAULT_BUCKET = 'rendasua-user-uploads';
export const APPEAL_EVIDENCE_VIEW_TTL_SECONDS = 900;

export function appealEvidenceBucket(): string {
  return process.env.APPEAL_EVIDENCE_BUCKET?.trim() || APPEAL_EVIDENCE_DEFAULT_BUCKET;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(code: string, error: string, extra: Record<string, unknown> = {}): HttpException {
  return new HttpException({ success: false, code, error, ...extra }, HttpStatus.BAD_REQUEST);
}

export function evidencePrefix(itemId: string): string {
  return `item-appeal-evidence/${itemId}/`;
}

/** Validates the upload request; returns the canonical content type + extension. */
export function validateEvidenceUpload(contentType: unknown, fileSize: unknown): { contentType: string; ext: string; size: number } {
  const ct = typeof contentType === 'string' ? contentType.toLowerCase().split(';')[0].trim() : '';
  const normalized = ct === 'image/jpg' ? 'image/jpeg' : ct;
  const ext = APPEAL_EVIDENCE_TYPES[normalized];
  if (!ext) {
    throw bad(RECOVERY_ERRORS.EVIDENCE_TYPE, 'Evidence must be a JPEG, PNG or WebP photo', {
      allowed: Object.keys(APPEAL_EVIDENCE_TYPES),
    });
  }
  const size = typeof fileSize === 'number' ? fileSize : Number.NaN;
  if (!Number.isInteger(size) || size <= 0 || size > APPEAL_EVIDENCE_MAX_BYTES) {
    throw bad(RECOVERY_ERRORS.EVIDENCE_SIZE, `Evidence photos must be 1 byte to ${APPEAL_EVIDENCE_MAX_BYTES / 1024 / 1024} MB`, {
      maxBytes: APPEAL_EVIDENCE_MAX_BYTES,
    });
  }
  return { contentType: normalized, ext, size };
}

/**
 * Accepts only keys of the exact shape we issue for this item:
 *   item-appeal-evidence/{itemId}/{uuid}.{jpg|png|webp}
 * No URL, other item, other prefix, traversal, encoding, whitespace, or extension.
 */
export function isOwnEvidenceKey(raw: unknown, itemId: string): boolean {
  if (typeof raw !== 'string' || !UUID_RE.test(itemId)) return false;
  const prefix = evidencePrefix(itemId.toLowerCase());
  if (!raw.startsWith(prefix)) return false;
  const m = /^([0-9a-f-]{36})\.([a-z]+)$/.exec(raw.slice(prefix.length));
  return !!m && UUID_RE.test(m[1]) && EXTENSIONS.has(m[2]);
}

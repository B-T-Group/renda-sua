import { HttpException, HttpStatus } from '@nestjs/common';
import { RECOVERY_ERRORS } from './item-recovery.constants';

/** Evidence photos live only in our bucket under items/{itemId}/appeal-evidence/. */
export const APPEAL_EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
export const APPEAL_EVIDENCE_URL_TTL_SECONDS = 600;
/** Raster only: SVG (scriptable) and anything else is refused. */
export const APPEAL_EVIDENCE_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const EXTENSIONS = new Set(Object.values(APPEAL_EVIDENCE_TYPES));

export interface EvidenceStorage {
  bucket: string;
  region: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(code: string, error: string, extra: Record<string, unknown> = {}): HttpException {
  return new HttpException({ success: false, code, error, ...extra }, HttpStatus.BAD_REQUEST);
}

export function evidencePrefix(itemId: string): string {
  return `items/${itemId}/appeal-evidence/`;
}

export function evidenceHost(storage: EvidenceStorage): string {
  return `${storage.bucket}.s3.${storage.region}.amazonaws.com`;
}

export function evidencePublicUrl(storage: EvidenceStorage, key: string): string {
  return `https://${evidenceHost(storage)}/${key}`;
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
 * Accepts only URLs of the exact shape we issue for this item:
 *   https://{bucket}.s3.{region}.amazonaws.com/items/{itemId}/appeal-evidence/{uuid}.{jpg|png|webp}
 * No other host, port, credentials, query, fragment, encoding, traversal, or extension.
 */
export function isOwnEvidenceUrl(raw: string, storage: EvidenceStorage, itemId: string): boolean {
  if (!UUID_RE.test(itemId)) return false;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash) return false;
  if (u.hostname !== evidenceHost(storage).toLowerCase()) return false;
  if (raw !== `https://${u.hostname}${u.pathname}`) return false; // no normalisation tricks
  const prefix = `/${evidencePrefix(itemId)}`;
  if (!u.pathname.startsWith(prefix)) return false;
  const file = u.pathname.slice(prefix.length);
  const m = /^([0-9a-f-]{36})\.([a-z]+)$/.exec(file);
  return !!m && UUID_RE.test(m[1]) && EXTENSIONS.has(m[2]);
}

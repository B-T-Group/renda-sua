import { HttpException, HttpStatus } from '@nestjs/common';

export const INSPECTION_EVIDENCE_MAX_BYTES = 8 * 1024 * 1024;
export const INSPECTION_UPLOAD_TTL_SECONDS = 600;
export const INSPECTION_VIEW_TTL_SECONDS = 600;
export const INSPECTION_EVIDENCE_BUCKET = 'rendasua-user-uploads';

/**
 * Bucket for inspection photos. Prod sets `RENTAL_INSPECTION_BUCKET` to the
 * dedicated Object Lock bucket. DEV leaves it unset and stays on
 * `rendasua-user-uploads` with prefix `dev/rental-inspection/`.
 * `APPEAL_EVIDENCE_BUCKET` remains a fallback so existing DEV/prod wiring is unchanged.
 */
export function inspectionEvidenceBucket(
  env: NodeJS.ProcessEnv = process.env
): string {
  return (
    env.RENTAL_INSPECTION_BUCKET?.trim() ||
    env.APPEAL_EVIDENCE_BUCKET?.trim() ||
    INSPECTION_EVIDENCE_BUCKET
  );
}

export const INSPECTION_EVIDENCE_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function inspectionKeyRoot(envName?: string): 'dev' | 'prod' {
  const name = (envName ?? process.env.DEPLOYMENT_ENV ?? process.env.NODE_ENV ?? '')
    .trim()
    .toLowerCase();
  return name === 'production' ? 'prod' : 'dev';
}

export function inspectionObjectKey(
  bookingId: string,
  mediaId: string,
  ext: string,
  envName?: string
): string {
  return `${inspectionKeyRoot(envName)}/rental-inspection/${bookingId.toLowerCase()}/${mediaId.toLowerCase()}.${ext}`;
}

/** Browser PUT target. Never a finalized evidence key. */
export function inspectionPendingObjectKey(
  bookingId: string,
  mediaId: string,
  ext: string,
  envName?: string
): string {
  return `${inspectionKeyRoot(envName)}/rental-inspection/pending/${bookingId.toLowerCase()}/${mediaId.toLowerCase()}.${ext}`;
}

/** Base64 `x-amz-checksum-sha256` value for a hex SHA-256 of the file bytes. */
export function inspectionChecksumHeader(sha256Hex: string): string {
  const hex = sha256Hex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw evidenceError('Evidence sha256 must be 64 hex characters');
  }
  return Buffer.from(hex, 'hex').toString('base64');
}

export function inspectionDerivativeKey(objectKey: string): string {
  return objectKey.replace(/\.(jpg|png|webp)$/, '.view.jpg');
}

export function validateInspectionUpload(
  contentType: unknown,
  fileSize: unknown
): { contentType: string; ext: string; size: number } {
  const raw = typeof contentType === 'string' ? contentType.toLowerCase().split(';')[0].trim() : '';
  const normalized = raw === 'image/jpg' ? 'image/jpeg' : raw;
  const ext = INSPECTION_EVIDENCE_TYPES[normalized];
  if (!ext) {
    throw evidenceError('Evidence must be a JPEG, PNG, or WebP photo');
  }
  const size = typeof fileSize === 'number' ? fileSize : Number(fileSize);
  if (!Number.isInteger(size) || size <= 0 || size > INSPECTION_EVIDENCE_MAX_BYTES) {
    throw evidenceError('Evidence photos must be between 1 byte and 8 MB');
  }
  return { contentType: normalized, ext, size };
}

const FINAL_KEY_RE =
  /^(dev|prod)\/rental-inspection\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i;
const PENDING_KEY_RE =
  /^(dev|prod)\/rental-inspection\/pending\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/i;

/** Final evidence only. A pending upload key is never evidence. */
export function isInspectionEvidenceKey(raw: unknown, bookingId: string): boolean {
  if (typeof raw !== 'string' || raw.includes('/pending/') || !UUID_RE.test(bookingId)) return false;
  const match = FINAL_KEY_RE.exec(raw);
  return !!match && match[2].toLowerCase() === bookingId.toLowerCase() && UUID_RE.test(match[3]);
}

export function isInspectionPendingKey(raw: unknown, bookingId: string): boolean {
  if (typeof raw !== 'string' || !UUID_RE.test(bookingId)) return false;
  const match = PENDING_KEY_RE.exec(raw);
  return !!match && match[2].toLowerCase() === bookingId.toLowerCase() && UUID_RE.test(match[3]);
}

function evidenceError(message: string): HttpException {
  return new HttpException(
    { success: false, code: 'RENTAL_INSPECTION_EVIDENCE', error: message, message },
    HttpStatus.BAD_REQUEST
  );
}

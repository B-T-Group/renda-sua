/** Prod-only private bucket for rental inspection evidence (photos; video later). */
export const RENTAL_INSPECTION_EVIDENCE_BUCKET_NAME =
  'rendasua-rental-inspection-evidence-prod';

/**
 * Staging PUT, finalize rewrite, and EXIF-stripped derivative all live under
 * this prefix. Nest keys are `{dev|prod}/rental-inspection/{bookingId}/{uuid}.ext`;
 * this bucket is production-only, so the code writes `prod/rental-inspection/`.
 */
export const RENTAL_INSPECTION_EVIDENCE_PREFIX = 'prod/rental-inspection/';

/**
 * Default Object Lock GOVERNANCE retention in days.
 * Leave undefined so Object Lock is enabled with no default retention.
 * Set a positive integer (or CDK context
 * `rentalInspectionObjectLockRetentionDays`) to apply a default period.
 */
export const RENTAL_INSPECTION_OBJECT_LOCK_RETENTION_DAYS: number | undefined =
  undefined;

export const RENTAL_INSPECTION_EVIDENCE_CORS_ORIGINS = [
  'https://rendasua.com',
  'https://www.rendasua.com',
] as const;

export const RENTAL_INSPECTION_EVIDENCE_CORS_METHODS = [
  'PUT',
  'GET',
  'HEAD',
] as const;

export const RENTAL_INSPECTION_EVIDENCE_CORS_HEADERS = [
  'Content-Type',
  'Content-Length',
] as const;

export const RENTAL_INSPECTION_EVIDENCE_ACCESS_POLICY_NAME =
  'rendasua-rental-inspection-evidence-prod';

/**
 * Parse a config/context retention value.
 * Empty/undefined → no default retention. A set value must be a positive integer.
 */
export function parseObjectLockRetentionDays(
  value: unknown
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `rentalInspectionObjectLockRetentionDays must be a positive integer of days, got: ${String(value)}`
    );
  }
  return n;
}

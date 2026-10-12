import { HttpException, HttpStatus } from '@nestjs/common';
import {
  detectCameroonPhone,
  validatePhoneNumber,
} from '../mobile-payments/phone-validation.util';

/**
 * #545 pay-at-confirm retry policy (Samuel, 2026-10-12).
 * - Operator MoMo prompts expire after ~5 minutes (prompt lifetime).
 * - Same phone: a new prompt replaces a pending one only after 90 s (D2).
 * - A changed phone replaces it immediately (D1), still rate limited.
 * - At most 5 new requests per order per 10 minutes (D2).
 */
export const ORDER_MOMO_PROMPT_LIFETIME_SECONDS = 300;
export const ORDER_MOMO_RESEND_MIN_AGE_SECONDS_DEFAULT = 90;
export const ORDER_MOMO_RETRY_LIMIT = 5;
export const ORDER_MOMO_RETRY_WINDOW_SECONDS = 600;
export const ORDER_MOMO_IDEMPOTENCY_WINDOW_SECONDS = 600;
/** Description marker on retry-created attempts; the rate limit counts these rows. */
export const PAY_AFTER_RETRY_DESCRIPTION_MARKER = '(after confirm retry)';

/** error_code values that mark an order tx we cancelled to make room for another one. */
export const SUPERSEDED_BY_RETRY = 'SUPERSEDED_BY_RETRY';
export const SUPERSEDED_BY_LATE_SUCCESS = 'SUPERSEDED_BY_LATE_SUCCESS';
export const SUPERSEDED_ERROR_CODES: ReadonlySet<string> = new Set([
  SUPERSEDED_BY_RETRY,
  SUPERSEDED_BY_LATE_SUCCESS,
]);
export const LATE_SUCCESS_APPLIED = 'LATE_SUCCESS_APPLIED';
export const DUPLICATE_PAYMENT_CREDITED = 'DUPLICATE_PAYMENT_CREDITED';

export type PayAfterRetryResult =
  | 'sent'
  | 'resent'
  | 'already_pending'
  | 'paid'
  | 'wallet';

export function resendMinAgeSeconds(raw?: string | number | null): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0
    ? Math.floor(n)
    : ORDER_MOMO_RESEND_MIN_AGE_SECONDS_DEFAULT;
}

export function paymentError(
  status: HttpStatus,
  code: string,
  message: string,
  extra: Record<string, unknown> = {}
): HttpException {
  return new HttpException({ statusCode: status, code, message, ...extra }, status);
}

/**
 * Validate a client-entered MoMo number with the backend validatePhoneNumber and
 * return it as E.164. The number must belong to the order's MoMo country; Cameroon
 * numbers must be on a MoMo operator (MTN / Orange).
 */
export function requireValidRetryPhone(
  raw: string,
  orderCountry?: string | null
): string {
  const region = (orderCountry || 'CM').trim().toUpperCase();
  const v = validatePhoneNumber(raw.trim(), region);
  const invalid = () =>
    paymentError(
      HttpStatus.BAD_REQUEST,
      'INVALID_MOMO_PHONE',
      'This phone number cannot receive a mobile money request for this order.'
    );
  if (!v.isValid || !v.countryCode || !v.nationalNumber) throw invalid();
  if (v.regionCode && v.regionCode !== region) throw invalid();
  const e164 = `+${v.countryCode}${v.nationalNumber}`;
  if (region === 'CM') {
    const cm = detectCameroonPhone(e164);
    if (!cm || cm.carrier === 'other') throw invalid();
  }
  return e164;
}

function digits(phone?: string | null): string {
  return String(phone || '').replace(/\D/g, '');
}

/** Same subscriber number, tolerant of stored formats with or without country code. */
export function samePhone(a?: string | null, b?: string | null): boolean {
  const da = digits(a);
  const db = digits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const n = Math.min(da.length, db.length, 9);
  return n >= 8 && da.slice(-n) === db.slice(-n);
}

/** "+237 6** *** 565": enough for the client to recognise the number. */
export function maskPhone(phone?: string | null): string | null {
  const d = digits(phone);
  if (d.length < 6) return null;
  const national = d.length > 9 ? d.slice(-9) : d;
  const cc = d.length > 9 ? d.slice(0, d.length - 9) : '';
  const masked = `${national[0]}** *** ${national.slice(-3)}`;
  return cc ? `+${cc} ${masked}` : masked;
}

export function ageSeconds(createdAt: string | undefined, now = Date.now()): number {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - t) / 1000);
}

export function promptExpiresAt(createdAt?: string | null): string | null {
  const t = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(t)) return null;
  return new Date(t + ORDER_MOMO_PROMPT_LIFETIME_SECONDS * 1000).toISOString();
}

export function normalizeIdempotencyKey(raw?: string | null): string | null {
  const key = String(raw ?? '').trim();
  if (!key) return null;
  if (key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw paymentError(
      HttpStatus.BAD_REQUEST,
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key must be 1-128 characters of letters, digits, . _ : -'
    );
  }
  return key;
}

export type ExistingTxDecision = 'already_pending' | 'supersede';

/** D1/D2: keep a young same-phone prompt; replace it on phone change or after min age. */
export function decideOnPendingTx(params: {
  ageSeconds: number;
  phoneChanged: boolean;
  minAgeSeconds: number;
}): ExistingTxDecision {
  if (params.phoneChanged) return 'supersede';
  return params.ageSeconds >= params.minAgeSeconds ? 'supersede' : 'already_pending';
}

/** Hasura surfaces unique-index violations as "Uniqueness violation". */
export function isUniqueViolation(error: unknown): boolean {
  const text = JSON.stringify(
    (error as any)?.response?.errors ?? (error as any)?.message ?? error ?? ''
  ).toLowerCase();
  return (
    text.includes('uniqueness violation') || text.includes('duplicate key')
  );
}

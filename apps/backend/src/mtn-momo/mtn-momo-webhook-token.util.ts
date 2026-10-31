import { createHmac, timingSafeEqual } from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_SHA256_RE = /^[0-9a-f]{64}$/i;

export function isMtnReferenceId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Per-request webhook token: HMAC-SHA256 of the MTN reference id, keyed with
 * MTN_MOMO_WEBHOOK_SECRET. MTN cannot send custom headers on callbacks, so the
 * token travels in the callback URL; binding it to the reference id means a
 * token seen in a log cannot be replayed against another payment.
 */
export function signMtnWebhookToken(
  secret: string,
  referenceId: string
): string {
  return createHmac('sha256', secret)
    .update(`mtn-momo-webhook:${referenceId.toLowerCase()}`)
    .digest('hex');
}

/** Constant-time check; false for any malformed input. Never throws. */
export function verifyMtnWebhookToken(
  secret: string | null | undefined,
  referenceId: unknown,
  token: unknown
): boolean {
  if (!secret) return false;
  if (!isMtnReferenceId(referenceId)) return false;
  if (typeof token !== 'string' || !HEX_SHA256_RE.test(token)) return false;
  const expected = Buffer.from(signMtnWebhookToken(secret, referenceId), 'hex');
  const provided = Buffer.from(token, 'hex');
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

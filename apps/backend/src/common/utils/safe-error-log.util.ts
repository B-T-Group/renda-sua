import {
  maskPhoneNumber,
  sanitizeProviderError,
} from '../../mobile-payments/sanitize-provider-error.util';
import { maskEmailForOtp } from '../../auth/otp-channel.util';

/**
 * L1: text that is safe to put in a log line for any caught error.
 * - Provider secrets are redacted and config/headers/request dropped
 *   (sanitizeProviderError).
 * - graphql-request ClientError messages append `: {"response":…,"request":{query,
 *   variables}}`; that JSON (payer phones, amounts, references) is cut off.
 * - Any remaining run of 8+ digits (phone numbers) is masked to its last 3 digits.
 */
export function safeErrorMessage(error: unknown): string {
  let message = sanitizeProviderError(error).message;
  const graphqlPayload = message.indexOf(': {"response"');
  if (graphqlPayload > 0) message = message.slice(0, graphqlPayload);
  return maskPhoneDigits(message);
}

/** Mask phone-like digit runs (8+ digits, optional +, spaces or dashes) to ***123. */
export function maskPhoneDigits(text: string): string {
  return text.replace(/\+?\d[\d\s-]{6,}\d/g, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 8 ? maskPhoneNumber(digits) : match;
  });
}

/** #616: recipient email for a log line: `ja***@example.com`; anything else `***`. */
export function maskEmailForLog(email: string | null | undefined): string {
  return maskEmailForOtp(email) ?? '***';
}

/** #616: recipient phone for a log line: last 3 digits only (`***456`). */
export function maskPhoneForLog(phone: string | null | undefined): string {
  return phone ? maskPhoneNumber(String(phone)) : '***';
}

/**
 * #616 QA L1: an account reference for a log line. Callers pass either a payer
 * phone or a wallet account UUID. Only a phone-like value (digits with optional
 * `+`, spaces, dashes, dots or parentheses, and at least 8 digits) is masked; any
 * other id (a UUID) is not PII and is logged unchanged so the line stays traceable.
 */
export function maskAccountRefForLog(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'unknown';
  const text = String(value);
  const phoneLike = /^\+?[\d\s().-]+$/.test(text) && text.replace(/\D/g, '').length >= 8;
  return phoneLike ? maskPhoneNumber(text) : text;
}

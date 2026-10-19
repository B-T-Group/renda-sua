import {
  maskPhoneNumber,
  sanitizeProviderError,
} from '../../mobile-payments/sanitize-provider-error.util';

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

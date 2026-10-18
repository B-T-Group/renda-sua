/**
 * Sanitize provider errors to prevent logging sensitive data (Authorization headers, API keys).
 * Never log a raw axios error: its config.headers carry Authorization (FreemoPay Basic
 * base64(appKey:secretKey), FedaPay Bearer sk_...).
 * Returns only safe error properties: message (redacted), status, code.
 */

interface SanitizedError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Keys whose values are always secret, in JSON / header / query forms.
 * - Quoted values are redacted up to the closing quote, honouring backslash escapes. An
 *   unterminated quote (e.g. after truncation) is redacted to the end of the line/input.
 * - Unquoted values are redacted up to the next separator, except an unquoted Authorization
 *   value, which runs to the end of the line ("Token abc").
 *
 * Performance (QA #589 D1): this runs synchronously on attacker-controlled text (request
 * URLs in every sampled Sentry transaction, provider error bodies). The key prefix is
 * anchored with a lookbehind (a match can only start where a [\w-] run starts) and bounded
 * to 40 chars, so the scan is linear. An unanchored lazy `[\w-]*?` here was quadratic
 * (16 KB took ~400 ms).
 */
const SECRET_KEY_NAMES =
  'new_secret_key|secret[_-]?key|client[_-]?secret|x[_-]secret|api[_-]?key|app[_-]?key|password|token|authorization|secret';
const SECRET_KEY_VALUE = new RegExp(
  `((?<![\\w-])["']?[\\w-]{0,40}?(${SECRET_KEY_NAMES})["']?\\s*[:=]\\s*)` +
    `(?:(["'])((?:\\\\.|(?!\\3)[^\\\\\\r\\n])*)(?:\\3|(?=[\\r\\n])|$)` +
    `|([^"',}\\s&]+(?:[ \\t]+[^"',}\\s&]+)*))`,
  'gi'
);

/** redactSecrets never scans more than this many characters (QA #589 D1). */
export const MAX_REDACT_INPUT = 8192;
const TRUNCATED_MARKER = '…[truncated]';

function redactKeyValue(
  match: string,
  prefix: string,
  key: string,
  quote: string | undefined,
  quoted: string | undefined,
  bare: string | undefined
): string {
  const value = quote ? quoted ?? '' : bare ?? '';
  // Already handled by the Basic/Bearer rules, or already redacted.
  if (/^(Basic|Bearer) REDACTED\b/.test(value) || value === '[REDACTED]') return match;
  if (quote) return `${prefix}${quote}[REDACTED]${quote}`;
  // Unquoted: only Authorization spans several words; others stop at the first word.
  if (/^authorization$/i.test(key)) return `${prefix}[REDACTED]`;
  const [first, ...rest] = value.split(/([ \t]+)/);
  void first;
  return `${prefix}[REDACTED]${rest.join('')}`;
}

/** Any value as text, without ever throwing (objects are JSON, circular ones a placeholder). */
export function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : json;
  } catch {
    try {
      return String(value);
    } catch {
      return '[unprintable value]';
    }
  }
}

/**
 * Redact API keys, bearer tokens and basic credentials from text.
 * Patterns: sk_(live|sandbox|test)_..., pk_(live|test)_..., whsec_..., Bearer <token>,
 * Basic <base64>, and key/value forms (secret, secret_key, new_secret_key, client_secret,
 * X-Secret, apiKey, app_key, secretKey, password, token, Authorization) in JSON, header and
 * query syntax. Non-string input is stringified first; input is capped at MAX_REDACT_INPUT.
 */
export function redactSecrets(text: unknown): string {
  let input = safeStringify(text);
  if (!input) return input;
  // Bound the work on attacker-controlled input; nothing past the cap is ever emitted.
  if (input.length > MAX_REDACT_INPUT) {
    input = `${input.slice(0, MAX_REDACT_INPUT)}${TRUNCATED_MARKER}`;
  }

  // Redact FedaPay/Stripe-style keys (keep the type visible but redact the value)
  let redacted = input.replace(
    /sk_(live|sandbox|test)_[A-Za-z0-9_-]+/gi,
    'sk_$1_REDACTED'
  );

  // Stripe-style publishable keys and webhook signing secrets (QA #589 D4)
  redacted = redacted.replace(/pk_(live|test)_[A-Za-z0-9_-]+/gi, 'pk_$1_REDACTED');
  redacted = redacted.replace(/whsec_[A-Za-z0-9_+/=-]+/gi, 'whsec_REDACTED');

  // Redact Bearer tokens (base64 / JWT / opaque, including + / = ~)
  redacted = redacted.replace(
    /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    'Bearer REDACTED'
  );

  // Redact Basic credentials (FreemoPay: base64(appKey:secretKey))
  redacted = redacted.replace(
    /Basic\s+[A-Za-z0-9+/=]+/gi,
    'Basic REDACTED'
  );

  // Redact secret-named keys' values ("secret_key":"…", X-Secret: …, apiKey=…)
  redacted = redacted.replace(SECRET_KEY_VALUE, redactKeyValue);

  return redacted;
}

/**
 * Sanitize a provider error for safe logging.
 * Removes config, headers, request, response.config and redacts secrets from message.
 * Never throws: a non-string message is stringified, and anything unprintable falls back
 * to a placeholder so the caller's catch block keeps its original error handling.
 */
export function sanitizeProviderError(error: any): SanitizedError {
  if (!error) {
    return { message: 'Unknown error' };
  }

  let message: string;
  try {
    const raw =
      typeof error === 'string'
        ? error
        : error.message || error.msg || 'Provider error';
    message = redactSecrets(raw) || 'Provider error';
  } catch {
    message = '[unprintable error]';
  }

  let status: unknown;
  let code: unknown;
  try {
    status = error.status || error.statusCode || error.httpStatus || error.response?.status;
    code = error.code || error.errorCode || error.error_code;
  } catch {
    // Exotic error objects (throwing getters): keep the message only.
  }

  return {
    message,
    ...(status !== undefined ? { status: status as number } : {}),
    ...(code ? { code: code as string } : {}),
  };
}

/**
 * A plain Error built from the sanitized fields, safe to rethrow to callers that log it.
 * Keeps message, status (also as response.status, for callers that branch on it) and code;
 * drops config, headers, request and the response body.
 */
export function toSanitizedError(
  error: any
): Error & { status?: number; code?: string; response?: { status: number } } {
  const sanitized = sanitizeProviderError(error);
  return Object.assign(new Error(sanitized.message), {
    ...(sanitized.status !== undefined
      ? { status: sanitized.status, response: { status: sanitized.status } }
      : {}),
    ...(sanitized.code ? { code: sanitized.code } : {}),
  });
}

/**
 * Provider response body (or any payload) as a redacted, length-capped string.
 * For interceptor logs: keeps provider diagnostics without dumping objects.
 */
export function redactProviderPayload(payload: unknown, maxLength = 500): string {
  if (payload === undefined || payload === null) return '';
  let text: string;
  if (typeof payload === 'string') {
    text = payload;
  } else {
    try {
      text = JSON.stringify(payload);
    } catch {
      text = '[unserializable payload]';
    }
  }
  // Cap before redacting so a huge provider body never costs more than a bounded scan.
  const redacted = redactSecrets((text ?? '').slice(0, maxLength * 4));
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}…` : redacted;
}

/**
 * Mask phone number, keeping only last 3 digits.
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 3) return '***';
  return '***' + cleaned.slice(-3);
}

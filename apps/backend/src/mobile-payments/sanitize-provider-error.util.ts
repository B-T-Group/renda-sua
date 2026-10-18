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
 * Keys whose values are always secret, in JSON / header / query forms. Quoted values are
 * redacted up to the closing quote; unquoted ones up to the next separator, except an
 * unquoted Authorization value, which runs to the end of the line ("Token abc").
 */
const SECRET_KEY_VALUE =
  /((?:["']?)[\w-]*?(new_secret_key|secret[_-]?key|x[_-]secret|api[_-]?key|app[_-]?key|password|token|authorization)["']?\s*[:=]\s*)(?:(["'])([^"'\r\n]*)\3|([^"',}\s&]+(?:[ \t]+[^"',}\s&]+)*))/gi;

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
 * Patterns: sk_(live|sandbox|test)_..., Bearer <token>, Basic <base64>, and key/value forms
 * (secret_key, new_secret_key, X-Secret, apiKey, app_key, secretKey, password, token,
 * Authorization) in JSON, header and query syntax. Non-string input is stringified first.
 */
export function redactSecrets(text: unknown): string {
  const input = safeStringify(text);
  if (!input) return input;

  // Redact FedaPay/Stripe-style keys (keep the type visible but redact the value)
  let redacted = input.replace(
    /sk_(live|sandbox|test)_[A-Za-z0-9_-]+/gi,
    'sk_$1_REDACTED'
  );

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
  const redacted = redactSecrets(text ?? '');
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

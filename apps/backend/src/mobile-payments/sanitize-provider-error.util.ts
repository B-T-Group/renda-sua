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
 * Redact API keys, bearer tokens and basic credentials from text.
 * Patterns: sk_(live|sandbox|test)_..., Bearer ... and Basic <base64>
 */
export function redactSecrets(text: string): string {
  if (!text) return text;
  
  // Redact FedaPay/Stripe-style keys (keep the type visible but redact the value)
  let redacted = text.replace(
    /sk_(live|sandbox|test)_[A-Za-z0-9_]+/gi,
    'sk_$1_REDACTED'
  );
  
  // Redact Bearer tokens
  redacted = redacted.replace(
    /Bearer\s+[A-Za-z0-9._-]+/gi,
    'Bearer REDACTED'
  );

  // Redact Basic credentials (FreemoPay: base64(appKey:secretKey))
  redacted = redacted.replace(
    /Basic\s+[A-Za-z0-9+/=]+/gi,
    'Basic REDACTED'
  );
  
  return redacted;
}

/**
 * Sanitize a provider error for safe logging.
 * Removes config, headers, request, response.config and redacts secrets from message.
 */
export function sanitizeProviderError(error: any): SanitizedError {
  if (!error) {
    return { message: 'Unknown error' };
  }

  // Extract safe properties
  const message = redactSecrets(
    error.message || 
    error.msg || 
    (typeof error === 'string' ? error : 'Provider error')
  );
  
  const status = error.status || 
                 error.statusCode || 
                 error.httpStatus || 
                 error.response?.status;
  
  const code = error.code || 
               error.errorCode || 
               error.error_code;

  return {
    message,
    ...(status !== undefined ? { status } : {}),
    ...(code ? { code } : {}),
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

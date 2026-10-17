/**
 * Sanitize provider errors to prevent logging sensitive data (Authorization headers, API keys).
 * Returns only safe error properties: message (redacted), status, code.
 */

interface SanitizedError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Redact API keys and bearer tokens from text.
 * Patterns: sk_(live|sandbox|test)_... and Bearer ...
 */
function redactSecrets(text: string): string {
  if (!text) return text;
  
  // Redact FedaPay/Stripe-style keys
  let redacted = text.replace(
    /sk_(live|sandbox|test)_[A-Za-z0-9]+/gi,
    'sk_$1_REDACTED'
  );
  
  // Redact Bearer tokens
  redacted = redacted.replace(
    /Bearer\s+[A-Za-z0-9_\-\.]+/gi,
    'Bearer REDACTED'
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
 * Mask phone number, keeping only last 3 digits.
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length <= 3) return '***';
  return '***' + cleaned.slice(-3);
}

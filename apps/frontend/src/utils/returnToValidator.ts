/**
 * Validates returnTo URLs to prevent open redirects.
 * Only allows same-origin relative paths.
 * 
 * IMPORTANT: Keep this in sync with backend return-to-validator.ts
 */
export function validateReturnTo(returnTo?: string): string {
  if (!returnTo) {
    return '/app';
  }

  const trimmed = returnTo.trim();
  
  // Reject empty strings
  if (!trimmed) {
    return '/app';
  }

  // Must start with / (relative path)
  if (!trimmed.startsWith('/')) {
    console.warn('[returnTo] Invalid: must be relative path starting with /', returnTo);
    return '/app';
  }

  // Reject protocol-relative URLs (//example.com/path)
  if (trimmed.startsWith('//')) {
    console.warn('[returnTo] Invalid: protocol-relative URL not allowed', returnTo);
    return '/app';
  }

  // Reject URLs with protocols (http://, https://, javascript:, data:, etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    console.warn('[returnTo] Invalid: protocol not allowed', returnTo);
    return '/app';
  }

  // Allow only valid path characters and common query/fragment components
  // This prevents backslash-based bypasses (\\ tricks)
  if (!/^\/[a-zA-Z0-9/_\-?=&.#%+]*$/.test(trimmed)) {
    console.warn('[returnTo] Invalid: contains invalid characters', returnTo);
    return '/app';
  }

  return trimmed;
}

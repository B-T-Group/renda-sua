import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Validates returnTo URLs to prevent open redirects.
 * Only allows same-origin relative paths.
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
    throw new HttpException(
      { success: false, error: 'returnTo must be a relative path starting with /' },
      HttpStatus.BAD_REQUEST
    );
  }

  // Reject protocol-relative URLs (//example.com/path)
  if (trimmed.startsWith('//')) {
    throw new HttpException(
      { success: false, error: 'returnTo cannot be a protocol-relative URL' },
      HttpStatus.BAD_REQUEST
    );
  }

  // Reject URLs with protocols (http://, https://, javascript:, data:, etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    throw new HttpException(
      { success: false, error: 'returnTo cannot contain a protocol' },
      HttpStatus.BAD_REQUEST
    );
  }

  // Allow only valid path characters and common query/fragment components
  // This prevents backslash-based bypasses (\\ tricks)
  if (!/^\/[a-zA-Z0-9/_\-?=&.#%+]*$/.test(trimmed)) {
    throw new HttpException(
      { success: false, error: 'returnTo contains invalid characters' },
      HttpStatus.BAD_REQUEST
    );
  }

  return trimmed;
}

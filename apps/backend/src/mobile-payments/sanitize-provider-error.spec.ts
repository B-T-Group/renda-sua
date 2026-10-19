/**
 * Sanitization tests for provider error handling
 * Ensures sensitive data is not exposed in error messages
 */
import { sanitizeProviderError, maskPhoneNumber } from './sanitize-provider-error.util';

describe('sanitizeProviderError', () => {
  describe('FreemoPay error sanitization', () => {
    it('should redact Bearer tokens from error messages', () => {
      const error = new Error('FreemoPay API error: Authorization Bearer abc123xyz456 failed');
      const sanitized = sanitizeProviderError(error);
      
      // Should redact Bearer tokens
      expect(sanitized.message).not.toContain('abc123xyz456');
      expect(sanitized.message).toContain('Bearer REDACTED');
    });

    it('should redact FedaPay-style API keys from error messages', () => {
      const error = new Error('API call failed with key sk_live_1234567890abcdef');
      const sanitized = sanitizeProviderError(error);
      
      // Should redact API keys
      expect(sanitized.message).not.toContain('1234567890abcdef');
      expect(sanitized.message).toContain('sk_live_REDACTED');
    });

    it('should extract and preserve HTTP status from errors', () => {
      const error: any = new Error('Payment failed');
      error.response = { status: 422 };
      
      const sanitized = sanitizeProviderError(error);
      
      // Should preserve status code
      expect(sanitized.status).toBe(422);
      expect(sanitized.message).toBe('Payment failed');
    });

    it('should extract error codes from provider errors', () => {
      const error: any = new Error('Insufficient funds');
      error.code = 'INSUFFICIENT_FUNDS';
      
      const sanitized = sanitizeProviderError(error);
      
      // Should preserve error code
      expect(sanitized.code).toBe('INSUFFICIENT_FUNDS');
    });
  });

  describe('General sanitization', () => {
    it('should handle errors without response data', () => {
      const error = new Error('Simple error message');
      const sanitized = sanitizeProviderError(error);
      
      expect(sanitized.message).toBe('Simple error message');
    });

    it('should handle non-Error objects', () => {
      const error = { message: 'Custom error object' };
      const sanitized = sanitizeProviderError(error as any);
      
      expect(sanitized.message).toBe('Custom error object');
    });

    it('should handle null/undefined errors', () => {
      const sanitized1 = sanitizeProviderError(null as any);
      expect(sanitized1.message).toBe('Unknown error');
      
      const sanitized2 = sanitizeProviderError(undefined as any);
      expect(sanitized2.message).toBe('Unknown error');
    });

    it('drops config/headers/request from axios-style errors (only message/status/code survive)', () => {
      const error: any = new Error('Request failed with status code 401');
      error.config = { headers: { Authorization: 'Bearer abc.def.ghi' }, data: '{"api_key":"sk_live_XYZ"}' };
      error.request = { _header: 'Authorization: Bearer abc.def.ghi' };
      error.response = { status: 401, config: error.config, data: { secret: 'sk_live_XYZ' } };
      const sanitized = sanitizeProviderError(error);

      expect(sanitized).toEqual({ message: 'Request failed with status code 401', status: 401 });
      expect(JSON.stringify(sanitized)).not.toMatch(/abc\.def\.ghi|sk_live_XYZ/);
    });
  });
});

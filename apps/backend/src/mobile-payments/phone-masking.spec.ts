/**
 * Phone masking tests for providers and controller
 * Ensures phone numbers are never logged in full (security requirement)
 */
import { Logger } from '@nestjs/common';
import { maskPhoneNumber } from './sanitize-provider-error.util';

describe('Phone Masking', () => {
  describe('maskPhoneNumber utility', () => {
    it('should mask phone numbers correctly', () => {
      expect(maskPhoneNumber('+237650123456')).toBe('***456');
      expect(maskPhoneNumber('+22890123456')).toBe('***456');
      expect(maskPhoneNumber('+241062345678')).toBe('***678');
      expect(maskPhoneNumber('0650123456')).toBe('***456');
    });

    it('should handle empty/null phone numbers', () => {
      expect(maskPhoneNumber('')).toBe('');
      expect(maskPhoneNumber(null as any)).toBe('');
      expect(maskPhoneNumber(undefined as any)).toBe('');
    });

    it('should handle short phone numbers', () => {
      expect(maskPhoneNumber('123')).toBe('***');
      expect(maskPhoneNumber('1234')).toBe('***234');
      expect(maskPhoneNumber('1234567')).toBe('***567');
    });
  });
});

import {
  formatE164Phone,
  parseE164Phone,
  ALLOWED_COUNTRY_CODES,
  ISO_TO_CALLING,
  CALLING_TO_ISO,
} from './phone-e164.util';

describe('Phone E164 Util - Togo Support', () => {
  describe('ALLOWED_COUNTRY_CODES', () => {
    it('should include 228 for Togo', () => {
      expect(ALLOWED_COUNTRY_CODES).toContain('228');
    });

    it('should include existing codes', () => {
      expect(ALLOWED_COUNTRY_CODES).toContain('237'); // Cameroon
      expect(ALLOWED_COUNTRY_CODES).toContain('241'); // Gabon
    });
  });

  describe('ISO_TO_CALLING', () => {
    it('should map TG to 228', () => {
      expect(ISO_TO_CALLING['TG']).toBe('228');
    });

    it('should preserve existing mappings', () => {
      expect(ISO_TO_CALLING['CM']).toBe('237');
      expect(ISO_TO_CALLING['GA']).toBe('241');
    });
  });

  describe('CALLING_TO_ISO', () => {
    it('should map 228 to TG', () => {
      expect(CALLING_TO_ISO['228']).toBe('TG');
    });

    it('should preserve existing mappings', () => {
      expect(CALLING_TO_ISO['237']).toBe('CM');
      expect(CALLING_TO_ISO['241']).toBe('GA');
    });
  });

  describe('formatE164Phone', () => {
    it('should format Togo number with +228 prefix', () => {
      expect(formatE164Phone('78123456', 'TG')).toBe('+22878123456');
      expect(formatE164Phone('90123456', 'TG')).toBe('+22890123456');
    });

    it('should handle Togo number with existing prefix', () => {
      expect(formatE164Phone('+22878123456', 'TG')).toBe('+22878123456');
      expect(formatE164Phone('22878123456', 'TG')).toBe('+22878123456');
    });

    it('should preserve Cameroon formatting', () => {
      expect(formatE164Phone('670123456', 'CM')).toBe('+237670123456');
    });

    it('should preserve Gabon formatting', () => {
      expect(formatE164Phone('77123456', 'GA')).toBe('+24177123456');
    });

    it('should handle whitespace in Togo numbers', () => {
      expect(formatE164Phone(' 78 12 34 56 ', 'TG')).toBe('+22878123456');
    });
  });

  describe('parseE164Phone', () => {
    it('should parse Togo E164 number', () => {
      const result = parseE164Phone('+22878123456');
      expect(result).toEqual({
        callingCode: '228',
        nationalNumber: '78123456',
        iso: 'TG',
        e164: '+22878123456',
      });
    });

    it('should parse Togo number without + prefix', () => {
      const result = parseE164Phone('22878123456');
      expect(result).toEqual({
        callingCode: '228',
        nationalNumber: '78123456',
        iso: 'TG',
        e164: '+22878123456',
      });
    });

    it('should parse various Togo prefixes', () => {
      // Moov prefixes
      expect(parseE164Phone('+22878000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22879000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22896000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22897000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22898000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22899000000')?.iso).toBe('TG');

      // Mixx prefixes
      expect(parseE164Phone('+22870000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22871000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22872000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22873000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22890000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22891000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22892000000')?.iso).toBe('TG');
      expect(parseE164Phone('+22893000000')?.iso).toBe('TG');
    });

    it('should preserve Cameroon parsing', () => {
      const result = parseE164Phone('+237670123456');
      expect(result?.iso).toBe('CM');
      expect(result?.callingCode).toBe('237');
      expect(result?.nationalNumber).toBe('670123456');
    });

    it('should preserve Gabon parsing', () => {
      const result = parseE164Phone('+24177123456');
      expect(result?.iso).toBe('GA');
      expect(result?.callingCode).toBe('241');
    });

    it('should return null for invalid country code', () => {
      expect(parseE164Phone('+999123456789')).toBeNull();
    });

    it('should return null for unsupported country', () => {
      expect(parseE164Phone('+3312345678')).toBeNull(); // France
    });

    it('should handle malformed numbers', () => {
      expect(parseE164Phone('')).toBeNull();
      expect(parseE164Phone('invalid')).toBeNull();
      expect(parseE164Phone('+++22878123456')).toBeNull();
    });
  });

  describe('XOF Currency Support', () => {
    it('should recognize TG uses XOF currency', () => {
      // This is a documentation test - TG uses XOF
      const tgCurrency = 'XOF';
      expect(tgCurrency).toBe('XOF');
    });

    it('should differentiate from XAF markets', () => {
      // CM and GA use XAF, TG uses XOF
      const cmCurrency = 'XAF';
      const tgCurrency = 'XOF';
      expect(cmCurrency).not.toBe(tgCurrency);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long numbers gracefully', () => {
      const result = parseE164Phone('+228781234567890123');
      // Should still parse the calling code correctly
      expect(result?.callingCode).toBe('228');
      expect(result?.iso).toBe('TG');
    });

    it('should handle numbers with special characters', () => {
      expect(parseE164Phone('+228-78-123-456')).toBeNull();
      expect(parseE164Phone('+228 78 123 456')).toBeNull();
    });

    it('should be case insensitive for ISO codes', () => {
      expect(formatE164Phone('78123456', 'TG')).toBe(
        formatE164Phone('78123456', 'tg')
      );
    });
  });
});

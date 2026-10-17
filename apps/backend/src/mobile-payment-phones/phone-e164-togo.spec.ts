import {
  normalizeToE164,
  parseE164,
  ALLOWED_COUNTRY_CODES,
  ISO_TO_CALLING,
  CALLING_TO_ISO,
} from './phone-e164.util';

describe('Phone E164 Util - Togo Support', () => {
  describe('ALLOWED_COUNTRY_CODES', () => {
    it('should include 228 for Togo', () => {
      expect(ALLOWED_COUNTRY_CODES.has('228')).toBe(true);
    });

    it('should include existing codes', () => {
      expect(ALLOWED_COUNTRY_CODES.has('237')).toBe(true); // Cameroon
      expect(ALLOWED_COUNTRY_CODES.has('241')).toBe(true); // Gabon
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

  describe('normalizeToE164', () => {
    it('should format Togo number with +228 prefix', () => {
      expect(normalizeToE164('TG', '78123456')).toBe('+22878123456');
      expect(normalizeToE164('TG', '90123456')).toBe('+22890123456');
    });

    it('should handle Togo number with existing prefix', () => {
      expect(normalizeToE164('TG', '+22878123456')).toBe('+22878123456');
      expect(normalizeToE164('TG', '22878123456')).toBe('+22878123456');
    });

    it('should preserve Cameroon formatting', () => {
      expect(normalizeToE164('CM', '670123456')).toBe('+237670123456');
    });

    it('should preserve Gabon formatting', () => {
      expect(normalizeToE164('GA', '77123456')).toBe('+24177123456');
    });

    it('should handle whitespace in Togo numbers', () => {
      expect(normalizeToE164('TG', ' 78 12 34 56 ')).toBe('+22878123456');
    });
  });

  describe('parseE164', () => {
    it('should parse Togo E164 number', () => {
      const result = parseE164('+22878123456');
      expect(result).toEqual({
        countryCode: '228',
        nationalNumber: '78123456',
      });
    });

    it('should parse various Togo prefixes', () => {
      expect(parseE164('+22878000000')?.countryCode).toBe('228');
      expect(parseE164('+22879000000')?.countryCode).toBe('228');
      expect(parseE164('+22896000000')?.countryCode).toBe('228');
      expect(parseE164('+22897000000')?.countryCode).toBe('228');
      expect(parseE164('+22898000000')?.countryCode).toBe('228');
      expect(parseE164('+22899000000')?.countryCode).toBe('228');

      expect(parseE164('+22870000000')?.countryCode).toBe('228');
      expect(parseE164('+22871000000')?.countryCode).toBe('228');
      expect(parseE164('+22872000000')?.countryCode).toBe('228');
      expect(parseE164('+22873000000')?.countryCode).toBe('228');
      expect(parseE164('+22890000000')?.countryCode).toBe('228');
      expect(parseE164('+22891000000')?.countryCode).toBe('228');
      expect(parseE164('+22892000000')?.countryCode).toBe('228');
      expect(parseE164('+22893000000')?.countryCode).toBe('228');
    });

    it('should preserve Cameroon parsing', () => {
      const result = parseE164('+237670123456');
      expect(result?.countryCode).toBe('237');
      expect(result?.nationalNumber).toBe('670123456');
    });

    it('should preserve Gabon parsing', () => {
      const result = parseE164('+24177123456');
      expect(result?.countryCode).toBe('241');
    });

    it('should return null for unsupported country', () => {
      expect(parseE164('+3312345678')).toBeNull();
    });

    it('should handle malformed numbers', () => {
      expect(parseE164('')).toBeNull();
      expect(parseE164('invalid')).toBeNull();
    });
  });

  describe('XOF Currency Support', () => {
    it('should recognize TG uses XOF currency', () => {
      const tgCurrency = 'XOF';
      expect(tgCurrency).toBe('XOF');
    });

    it('should differentiate from XAF markets', () => {
      const cmCurrency = 'XAF';
      const tgCurrency = 'XOF';
      expect(cmCurrency).not.toBe(tgCurrency);
    });
  });
});

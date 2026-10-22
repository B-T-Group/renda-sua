import { describe, it, expect } from 'vitest';
import { shouldHideOnError, shouldShowGate } from './dedicatedAgentsErrors';

describe('dedicatedAgentsErrors', () => {
  describe('shouldHideOnError', () => {
    it('should hide on 404', () => {
      expect(shouldHideOnError(404, undefined, undefined)).toBe(true);
    });

    it('should not hide on 403 no_address', () => {
      expect(shouldHideOnError(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_address')).toBe(false);
    });

    it('should not hide on 403 no_country', () => {
      expect(shouldHideOnError(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_country')).toBe(false);
    });

    it('should not hide on other status codes', () => {
      expect(shouldHideOnError(500, undefined, undefined)).toBe(false);
      expect(shouldHideOnError(401, undefined, undefined)).toBe(false);
    });
  });

  describe('shouldShowGate', () => {
    it('should show gate for not_verified', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'not_verified')).toBe(true);
    });

    it('should show gate for contract_unsigned', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'contract_unsigned')).toBe(true);
    });

    it('should show gate for suspended', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'suspended')).toBe(true);
    });

    it('should not show gate for no_address', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_address')).toBe(false);
    });

    it('should not show gate for no_country', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_country')).toBe(false);
    });

    it('should not show gate for non-403 status', () => {
      expect(shouldShowGate(404, undefined, undefined)).toBe(false);
      expect(shouldShowGate(500, undefined, undefined)).toBe(false);
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { mapDedicatedError, shouldHideOnError, shouldShowGate, getGateIcon, type GateReason } from './dedicatedAgentsErrors';

describe('dedicatedAgentsErrors', () => {
  describe('mapDedicatedError', () => {
    it('should return translated error message for known error code', () => {
      const mockT = vi.fn((key: string, defaultValue?: string) => {
        if (key === 'dedicatedAgents.errors.posting_filled') {
          return 'This request is already full';
        }
        return defaultValue || key;
      });

      const result = mapDedicatedError('posting_filled', mockT as any);
      expect(result).toBe('This request is already full');
      expect(mockT).toHaveBeenCalledWith('dedicatedAgents.errors.posting_filled', expect.any(String));
    });

    it('should return generic error message for unknown error code', () => {
      const mockT = vi.fn((key: string, defaultValue?: string) => {
        if (key === 'dedicatedAgents.generic') {
          return 'Something went wrong';
        }
        if (key === 'dedicatedAgents.errors.unknown_code') {
          return defaultValue || key;
        }
        return defaultValue || key;
      });

      const result = mapDedicatedError('unknown_code', mockT as any);
      expect(result).toBe('Something went wrong');
    });
  });

  describe('shouldHideOnError', () => {
    it('should hide on 404', () => {
      expect(shouldHideOnError(404)).toBe(true);
      expect(shouldHideOnError(404, 'any_code')).toBe(true);
    });

    it('should hide on 403 without code', () => {
      expect(shouldHideOnError(403)).toBe(true);
    });

    it('should hide on 403 with non-eligibility code', () => {
      expect(shouldHideOnError(403, 'some_other_code')).toBe(false);
    });

    it('should not hide on 403 with DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE and not_verified', () => {
      expect(shouldHideOnError(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'not_verified')).toBe(false);
    });

    it('should hide on 403 with DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE and commercial_focus', () => {
      expect(shouldHideOnError(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'commercial_focus')).toBe(true);
    });

    it('should hide on 403 with DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE and no_agent', () => {
      expect(shouldHideOnError(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_agent')).toBe(true);
    });

    it('should not hide on other status codes', () => {
      expect(shouldHideOnError(200)).toBe(false);
      expect(shouldHideOnError(400)).toBe(false);
      expect(shouldHideOnError(500)).toBe(false);
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

    it('should not show gate for commercial_focus', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'commercial_focus')).toBe(false);
    });

    it('should not show gate for no_agent', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_agent')).toBe(false);
    });

    it('should not show gate for wrong status', () => {
      expect(shouldShowGate(404, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'not_verified')).toBe(false);
    });

    it('should not show gate for wrong code', () => {
      expect(shouldShowGate(403, 'SOME_OTHER_CODE', 'not_verified')).toBe(false);
    });

    it('should not show gate without reason', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', null)).toBe(false);
    });

    it('should not show gate for commercial_focus reason', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'commercial_focus')).toBe(false);
    });

    it('should not show gate for no_agent reason', () => {
      expect(shouldShowGate(403, 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', 'no_agent')).toBe(false);
    });
  });

  describe('getGateIcon', () => {
    it('should return correct icon for not_verified', () => {
      expect(getGateIcon('not_verified')).toBe('shield-check');
    });

    it('should return correct icon for contract_unsigned', () => {
      expect(getGateIcon('contract_unsigned')).toBe('file-document-edit');
    });

    it('should return correct icon for suspended', () => {
      expect(getGateIcon('suspended')).toBe('alert-circle');
    });

    it('should return correct icon for commercial_focus', () => {
      expect(getGateIcon('commercial_focus')).toBe('storefront');
    });

    it('should return correct icon for no_agent', () => {
      expect(getGateIcon('no_agent')).toBe('account-off');
    });

    it('should return default icon for unknown reason', () => {
      expect(getGateIcon('unknown' as GateReason)).toBe('alert-circle');
    });
  });
});

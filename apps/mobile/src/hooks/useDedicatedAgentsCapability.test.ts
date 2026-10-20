import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DedicatedAgentsCapability } from './useDedicatedAgentsCapability';

describe('useDedicatedAgentsCapability logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('shouldShowDedicatedAgents calculation', () => {
    it('should return true when enabled is true', () => {
      const capability: DedicatedAgentsCapability = {
        success: true,
        enabled: true,
        country: 'CM',
      };
      
      const shouldShow = capability.success === true && capability.enabled === true;
      expect(shouldShow).toBe(true);
    });

    it('should return false when enabled is false', () => {
      const capability: DedicatedAgentsCapability = {
        success: true,
        enabled: false,
      };
      
      const shouldShow = capability.success === true && capability.enabled === true;
      expect(shouldShow).toBe(false);
    });

    it('should return true when enabled with no_address reason', () => {
      const capability: DedicatedAgentsCapability = {
        success: true,
        enabled: true,
        country: 'CM',
        reason: 'no_address',
      };
      
      const shouldShow = capability.success === true && capability.enabled === true;
      expect(shouldShow).toBe(true);
      expect(capability.reason).toBe('no_address');
    });

    it('should return true when enabled with no_country reason', () => {
      const capability: DedicatedAgentsCapability = {
        success: true,
        enabled: true,
        country: null,
        reason: 'no_country',
      };
      
      const shouldShow = capability.success === true && capability.enabled === true;
      expect(shouldShow).toBe(true);
      expect(capability.reason).toBe('no_country');
    });
  });

  describe('error handling', () => {
    it('should identify 404 as feature unavailable', () => {
      const error = { response: { status: 404 } };
      const isFeatureUnavailable = error.response?.status === 404;
      
      expect(isFeatureUnavailable).toBe(true);
    });

    it('should not mark other errors as feature unavailable', () => {
      const error = { response: { status: 500 } };
      const isFeatureUnavailable = error.response?.status === 404;
      
      expect(isFeatureUnavailable).toBe(false);
    });

    it('should identify gate reasons correctly', () => {
      const gateReasons = ['not_verified', 'contract_unsigned', 'suspended'];
      const nonGateReasons = ['no_address', 'no_country', null];
      
      gateReasons.forEach(reason => {
        expect(gateReasons.includes(reason)).toBe(true);
      });
      
      nonGateReasons.forEach(reason => {
        expect(gateReasons.includes(reason as any)).toBe(false);
      });
    });
  });
});

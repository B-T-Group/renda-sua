import { describe, it, expect } from 'vitest';

describe('useDedicatedAgentsCapability logic', () => {
  it('should show dedicated agents when enabled and no blocking reason', () => {
    const capability: any = {
      success: true,
      enabled: true,
      country: 'CM',
    };

    const shouldShow = 
      capability.success === true && 
      capability.enabled === true &&
      capability.reason !== 'commercial_focus' &&
      capability.reason !== 'no_agent';

    expect(shouldShow).toBe(true);
  });

  it('should hide when enabled is false', () => {
    const capability: any = {
      success: true,
      enabled: false,
      country: 'CM',
    };

    const shouldShow = 
      capability.success === true && 
      capability.enabled === true &&
      capability.reason !== 'commercial_focus' &&
      capability.reason !== 'no_agent';

    expect(shouldShow).toBe(false);
  });

  it('should hide on commercial_focus reason', () => {
    const capability: any = {
      success: true,
      enabled: true,
      country: 'CM',
      reason: 'commercial_focus' as const,
    };

    const shouldShow = 
      capability.success === true && 
      capability.enabled === true &&
      capability.reason !== 'commercial_focus' &&
      capability.reason !== 'no_agent';

    expect(shouldShow).toBe(false);
  });

  it('should hide on no_agent reason', () => {
    const capability: any = {
      success: true,
      enabled: true,
      country: 'CM',
      reason: 'no_agent' as const,
    };

    const shouldShow = 
      capability.success === true && 
      capability.enabled === true &&
      capability.reason !== 'commercial_focus' &&
      capability.reason !== 'no_agent';

    expect(shouldShow).toBe(false);
  });

  it('should hide on 404 error', () => {
    const capability: any = {
      success: false,
      enabled: false,
    };

    const shouldShow = 
      capability.success === true && 
      capability.enabled === true &&
      capability.reason !== 'commercial_focus' &&
      capability.reason !== 'no_agent';

    expect(shouldShow).toBe(false);
  });

  it('should hide on network error', () => {
    const capability: any = {
      success: false,
    };

    const shouldShow = 
      capability.success === true && 
      capability.enabled === true;

    expect(shouldShow).toBe(false);
  });
});

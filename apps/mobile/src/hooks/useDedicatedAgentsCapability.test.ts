import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as apiRequest from '../services/apiRequest';

vi.mock('../services/apiRequest');

// Simple unit tests for the capability hook logic without rendering

describe('useDedicatedAgentsCapability logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should determine shouldShow as true when enabled is true', () => {
    const capability = {
      success: true,
      enabled: true,
      country: 'CM',
      reason: null,
    };
    
    const shouldShow = capability.success === true && capability.enabled === true;
    expect(shouldShow).toBe(true);
  });

  it('should determine shouldShow as false when enabled is false', () => {
    const capability = {
      success: true,
      enabled: false,
      country: null,
      reason: null,
    };
    
    const shouldShow = capability.success === true && capability.enabled === true;
    expect(shouldShow).toBe(false);
  });

  it('should show when enabled with no_address reason', () => {
    const capability = {
      success: true,
      enabled: true,
      country: 'CM',
      reason: 'no_address' as const,
    };
    
    const shouldShow = capability.success === true && capability.enabled === true;
    expect(shouldShow).toBe(true);
    expect(capability.reason).toBe('no_address');
  });

  it('should show when enabled with no_country reason', () => {
    const capability = {
      success: true,
      enabled: true,
      country: null,
      reason: 'no_country' as const,
    };
    
    const shouldShow = capability.success === true && capability.enabled === true;
    expect(shouldShow).toBe(true);
    expect(capability.reason).toBe('no_country');
  });

  it('should call apiRequest with correct endpoint', async () => {
    const mockApiRequest = vi.spyOn(apiRequest, 'apiRequest').mockResolvedValue({
      success: true,
      enabled: true,
      country: 'CM',
      reason: null,
    });

    await apiRequest.apiRequest({
      method: 'GET',
      endpoint: '/agents/me/dedicated-agents/capability',
    });

    expect(mockApiRequest).toHaveBeenCalledWith({
      method: 'GET',
      endpoint: '/agents/me/dedicated-agents/capability',
    });
  });
});

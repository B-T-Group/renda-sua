import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useDedicatedAgentsCapability } from './useDedicatedAgentsCapability';
import * as apiRequest from '../services/apiRequest';

vi.mock('../services/apiRequest');

describe('useDedicatedAgentsCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return enabled true when capability is enabled', async () => {
    vi.spyOn(apiRequest, 'apiRequest').mockResolvedValue({
      success: true,
      enabled: true,
      country: 'CM',
      reason: null,
    });

    const { result } = renderHook(() => useDedicatedAgentsCapability());

    await waitFor(() => {
      expect(result.current.shouldShowDedicatedAgents).toBe(true);
    });

    expect(result.current.capability).toEqual({
      success: true,
      enabled: true,
      country: 'CM',
      reason: null,
    });
  });

  it('should return enabled false when capability is disabled', async () => {
    vi.spyOn(apiRequest, 'apiRequest').mockResolvedValue({
      success: true,
      enabled: false,
      country: null,
      reason: null,
    });

    const { result } = renderHook(() => useDedicatedAgentsCapability());

    await waitFor(() => {
      expect(result.current.shouldShowDedicatedAgents).toBe(false);
    });
  });

  it('should show dedicated agents when enabled with no_address reason', async () => {
    vi.spyOn(apiRequest, 'apiRequest').mockResolvedValue({
      success: true,
      enabled: true,
      country: 'CM',
      reason: 'no_address',
    });

    const { result } = renderHook(() => useDedicatedAgentsCapability());

    await waitFor(() => {
      expect(result.current.shouldShowDedicatedAgents).toBe(true);
      expect(result.current.capability?.reason).toBe('no_address');
    });
  });

  it('should show dedicated agents when enabled with no_country reason', async () => {
    vi.spyOn(apiRequest, 'apiRequest').mockResolvedValue({
      success: true,
      enabled: true,
      country: null,
      reason: 'no_country',
    });

    const { result } = renderHook(() => useDedicatedAgentsCapability());

    await waitFor(() => {
      expect(result.current.shouldShowDedicatedAgents).toBe(true);
      expect(result.current.capability?.reason).toBe('no_country');
    });
  });

  it('should handle 404 as feature disabled', async () => {
    vi.spyOn(apiRequest, 'apiRequest').mockRejectedValue({
      response: { status: 404 },
    });

    const { result } = renderHook(() => useDedicatedAgentsCapability());

    await waitFor(() => {
      expect(result.current.shouldShowDedicatedAgents).toBe(false);
      expect(result.current.featureUnavailable).toBe(true);
    });
  });

  it('should handle network errors', async () => {
    vi.spyOn(apiRequest, 'apiRequest').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDedicatedAgentsCapability());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });
});

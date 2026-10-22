/**
 * Renders the real hook (jest-expo + RNTL renderHook) against a mocked
 * apiRequest and asserts the state it exposes.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { apiRequest } from '../services/apiClient';
import { useDedicatedAgentsCapability } from './useDedicatedAgentsCapability';

jest.mock('../services/apiClient', () => ({ apiRequest: jest.fn() }));

const mockApi = jest.mocked(apiRequest);

async function renderCapability() {
  const view = await renderHook(() => useDedicatedAgentsCapability());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view.result;
}

describe('useDedicatedAgentsCapability', () => {
  beforeEach(() => mockApi.mockReset());

  it('stays loading and hidden until the request settles', async () => {
    mockApi.mockReturnValue(new Promise(() => undefined));
    const view = await renderHook(() => useDedicatedAgentsCapability());
    expect(view.result.current.loading).toBe(true);
    expect(view.result.current.shouldShowDedicatedAgents).toBe(false);
  });

  it('calls the agent capability endpoint exactly once', async () => {
    mockApi.mockResolvedValue({ success: true, enabled: true, country: 'CM', reason: null });
    await renderCapability();
    expect(mockApi).toHaveBeenCalledTimes(1);
    expect(mockApi).toHaveBeenCalledWith('/agents/me/dedicated-agents/capability', { method: 'GET' });
  });

  it('shows the feature when the backend reports enabled', async () => {
    mockApi.mockResolvedValue({ success: true, enabled: true, country: 'CM', reason: null });
    const result = await renderCapability();
    expect(result.current.shouldShowDedicatedAgents).toBe(true);
    expect(result.current.capability).toEqual({ success: true, enabled: true, country: 'CM', reason: null });
  });

  it('still shows the feature for enabled + no_address (address CTA case)', async () => {
    mockApi.mockResolvedValue({ success: true, enabled: true, country: null, reason: 'no_address' });
    const result = await renderCapability();
    expect(result.current.shouldShowDedicatedAgents).toBe(true);
    expect(result.current.capability?.reason).toBe('no_address');
  });

  it('hides the feature when the backend reports disabled', async () => {
    mockApi.mockResolvedValue({ success: true, enabled: false, country: 'CM', reason: null });
    const result = await renderCapability();
    expect(result.current.shouldShowDedicatedAgents).toBe(false);
  });

  it('treats a 404 as feature off', async () => {
    mockApi.mockRejectedValue({ status: 404 });
    const result = await renderCapability();
    expect(result.current.capability).toEqual({ success: false, enabled: false });
    expect(result.current.shouldShowDedicatedAgents).toBe(false);
  });

  it('hides the feature on other errors', async () => {
    mockApi.mockRejectedValue({ status: 500 });
    const result = await renderCapability();
    expect(result.current.capability).toEqual({ success: false });
    expect(result.current.shouldShowDedicatedAgents).toBe(false);
  });
});

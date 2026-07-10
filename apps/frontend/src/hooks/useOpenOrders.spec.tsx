import { act, renderHook, waitFor } from '@testing-library/react';
import { useOpenOrders } from './useOpenOrders';
import type { Order } from './useAgentOrders';

const mockGet = jest.fn();
let mockApiClient: { get: jest.Mock } | null;
let mockProfile: any;

jest.mock('./useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

jest.mock('../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({ profile: mockProfile }),
}));

const openOrder = {
  id: 'order-1',
  order_number: 'ORD-1',
  current_status: 'ready_for_pickup',
} as Order;

describe('useOpenOrders', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockApiClient = { get: mockGet };
    mockProfile = {
      agent: {
        id: 'agent-1',
        is_verified: false,
      },
    };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps preview orders non-claimable for unverified agents', async () => {
    mockGet.mockResolvedValue({
      data: {
        success: true,
        orders: [openOrder],
        canClaim: false,
        previewMode: 'country',
      },
    });

    const { result } = renderHook(() => useOpenOrders());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/orders/open');
    expect(result.current.openOrders).toEqual([openOrder]);
    expect(result.current.canClaim).toBe(false);
    expect(result.current.previewMode).toBe('country');
  });

  it('refetches orders when an agent becomes verified', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          success: true,
          orders: [],
          canClaim: false,
          previewMode: 'country',
        },
      })
      .mockResolvedValueOnce({
        data: {
          success: true,
          orders: [openOrder],
          canClaim: true,
          previewMode: undefined,
        },
      });

    const { result, rerender } = renderHook(() => useOpenOrders());

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    mockProfile = {
      agent: {
        id: 'agent-1',
        is_verified: true,
      },
    };
    rerender();

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    expect(result.current.openOrders).toEqual([openOrder]);
    expect(result.current.canClaim).toBe(true);
    expect(result.current.previewMode).toBeUndefined();
  });

  it('fails closed after a refetch error clears previously claimable orders', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        success: true,
        orders: [openOrder],
        canClaim: true,
        previewMode: 'region',
      },
    });

    const { result } = renderHook(() => useOpenOrders());

    await waitFor(() => expect(result.current.canClaim).toBe(true));

    mockGet.mockRejectedValueOnce({
      response: { data: { error: 'Network unavailable' } },
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.openOrders).toEqual([]);
    expect(result.current.canClaim).toBe(false);
    expect(result.current.previewMode).toBeUndefined();
    expect(result.current.error).toBe('Network unavailable');
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { clearMarketPickerCountsCache, useMarketPickerCounts } from './useMarketPickerCounts';

const mockGet = jest.fn();
const mockApi = { get: mockGet };
jest.mock('./useApiClient', () => ({ useApiClient: () => mockApi }));

const statesBody = {
  states: [{ state: 'Littoral', inventoryCount: 640, rentalCount: 18 }],
  totalItemCount: 1240,
  totalRentalCount: 32,
};

function route(opts: { exports?: number | 'fail'; states?: 'fail' }) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/locations/market-states') {
      return opts.states === 'fail'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ data: statesBody });
    }
    if (opts.exports === 'fail') return Promise.reject(new Error('boom'));
    return Promise.resolve({ data: { data: { items: [], total: opts.exports ?? 0 } } });
  });
}

beforeEach(() => {
  mockGet.mockReset();
  clearMarketPickerCountsCache();
});

describe('useMarketPickerCounts', () => {
  it('uses market-states catalog=all plus one export_only count (limit=1), no summing', async () => {
    route({ exports: 86 });
    const { result } = renderHook(() => useMarketPickerCounts('CM', true));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toEqual({ rentals: 32, exports: 86, shop: 1240 });
    expect(result.current.states).toEqual([
      { state: 'Littoral', inventoryCount: 640, rentalCount: 18, itemCount: 640 },
    ]);
    expect(mockGet).toHaveBeenCalledWith('/locations/market-states', {
      params: { countryCode: 'CM', catalog: 'all' },
    });
    expect(mockGet).toHaveBeenCalledWith('/inventory-items?export_only=true&limit=1&country_code=CM');
  });

  it('returns no counts (strip hidden) when the exports call fails but keeps state rows', async () => {
    route({ exports: 'fail' });
    const { result } = renderHook(() => useMarketPickerCounts('CM', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toBeNull();
    expect(result.current.states).toHaveLength(1);
    expect(result.current.statesFailed).toBe(false);
  });

  it('flags a failed states call and returns no counts', async () => {
    route({ exports: 3, states: 'fail' });
    const { result } = renderHook(() => useMarketPickerCounts('CM', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toBeNull();
    expect(result.current.states).toEqual([]);
    expect(result.current.statesFailed).toBe(true);
  });

  it('keeps a real zero exports count (not a failure)', async () => {
    route({ exports: 0 });
    const { result } = renderHook(() => useMarketPickerCounts('CA', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts?.exports).toBe(0);
  });

  it('does nothing while the dialog is closed', () => {
    route({ exports: 1 });
    const { result } = renderHook(() => useMarketPickerCounts('CM', false));
    expect(result.current.loading).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

import { renderHook, waitFor } from '@testing-library/react-native';
import { useMarketPickerCounts } from './useMarketPickerCounts';

const mockFetchStates = jest.fn();
const mockFetchExports = jest.fn();
jest.mock('../services/marketStatesApi', () => ({
  fetchMarketStates: (...a: unknown[]) => mockFetchStates(...a),
  fetchExportsIntoMarketCount: (...a: unknown[]) => mockFetchExports(...a),
}));

const states = {
  states: [{ state: 'Littoral', itemCount: 640, inventoryCount: 640, rentalCount: 18 }],
  totalItemCount: 1240,
  totalInventoryCount: 1240,
  totalRentalCount: 32,
};

beforeEach(() => {
  mockFetchStates.mockReset();
  mockFetchExports.mockReset();
});

describe('useMarketPickerCounts', () => {
  it('loads market-states catalog=all and one exports total, without summing', async () => {
    mockFetchStates.mockResolvedValue(states);
    mockFetchExports.mockResolvedValue(86);
    const { result } = await renderHook(() => useMarketPickerCounts('CM', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toEqual({ rentals: 32, exports: 86, shop: 1240 });
    expect(result.current.totals).toEqual({ rentals: 32, shop: 1240 });
    expect(mockFetchStates).toHaveBeenCalledWith('CM', 'all');
    expect(mockFetchExports).toHaveBeenCalledWith('CM', expect.anything());
  });

  it('reports loading with no counts while the calls are pending', async () => {
    mockFetchStates.mockReturnValue(new Promise(() => undefined));
    mockFetchExports.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useMarketPickerCounts('CM', true));
    expect(result.current.loading).toBe(true);
    expect(result.current.counts).toBeNull();
    expect(result.current.states).toEqual([]);
  });

  it('hides counts when the exports call fails but keeps states and totals', async () => {
    mockFetchStates.mockResolvedValue(states);
    mockFetchExports.mockRejectedValue(new Error('boom'));
    const { result } = await renderHook(() => useMarketPickerCounts('CM', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toBeNull();
    expect(result.current.totals).toEqual({ rentals: 32, shop: 1240 });
    expect(result.current.states).toHaveLength(1);
    expect(result.current.statesFailed).toBe(false);
  });

  it('flags a failed states call', async () => {
    mockFetchStates.mockRejectedValue(new Error('boom'));
    mockFetchExports.mockResolvedValue(3);
    const { result } = await renderHook(() => useMarketPickerCounts('CM', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toBeNull();
    expect(result.current.statesFailed).toBe(true);
    expect(result.current.states).toEqual([]);
  });

  it('treats a zero exports total as a real count', async () => {
    mockFetchStates.mockResolvedValue(states);
    mockFetchExports.mockResolvedValue(0);
    const { result } = await renderHook(() => useMarketPickerCounts('CA', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts?.exports).toBe(0);
  });

  it('does not fetch while the sheet is closed', async () => {
    const { result } = await renderHook(() => useMarketPickerCounts('CM', false));
    expect(result.current.loading).toBe(false);
    expect(mockFetchStates).not.toHaveBeenCalled();
  });

  it('never shows the previous country while a new one loads', async () => {
    mockFetchStates.mockResolvedValue(states);
    mockFetchExports.mockResolvedValue(86);
    const { result, rerender } = await renderHook(
      ({ cc }: { cc: string }) => useMarketPickerCounts(cc, true),
      { initialProps: { cc: 'CM' } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockFetchStates.mockReturnValue(new Promise(() => undefined));
    await rerender({ cc: 'GA' });
    expect(result.current.loading).toBe(true);
    expect(result.current.counts).toBeNull();
  });
});

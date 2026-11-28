import { beforeEach, describe, expect, it, vi } from 'vitest';

const publicApiGet = vi.fn();
vi.mock('./publicApiClient', () => ({ publicApiGet: (...a: unknown[]) => publicApiGet(...a) }));

import { fetchExportsIntoMarketCount, fetchMarketStates } from './marketStatesApi';

beforeEach(() => publicApiGet.mockReset());

describe('fetchMarketStates catalog=all', () => {
  it('keeps shop and rentals separate instead of summing them', async () => {
    publicApiGet.mockResolvedValue({
      success: true,
      states: [
        { state: 'Littoral', inventoryCount: 640, rentalCount: 18 },
        { state: 'Centre', inventoryCount: 402, rentalCount: 11 },
      ],
      totalItemCount: 1240,
      totalRentalCount: 32,
    });
    const res = await fetchMarketStates('CM', 'all');
    expect(publicApiGet).toHaveBeenCalledWith('/locations/market-states?countryCode=CM&catalog=all');
    expect(res.totalInventoryCount).toBe(1240);
    expect(res.totalRentalCount).toBe(32);
    expect(res.states).toEqual([
      { state: 'Littoral', itemCount: 640, inventoryCount: 640, rentalCount: 18 },
      { state: 'Centre', itemCount: 402, inventoryCount: 402, rentalCount: 11 },
    ]);
  });
});

describe('fetchMarketStates single catalogs (unchanged contract)', () => {
  it('inventory returns the shop total and per-state itemCount', async () => {
    publicApiGet.mockResolvedValue({ states: [{ state: 'A', itemCount: 5 }], totalItemCount: 9 });
    const res = await fetchMarketStates('CM');
    expect(res.totalItemCount).toBe(9);
    expect(res.states[0].itemCount).toBe(5);
    expect(res.totalRentalCount).toBeUndefined();
  });

  it('rentals returns the rentals total', async () => {
    publicApiGet.mockResolvedValue({
      states: [{ state: 'A', itemCount: 3 }],
      totalItemCount: 3,
      totalRentalCount: 3,
    });
    const res = await fetchMarketStates('CM', 'rentals');
    expect(res.totalItemCount).toBe(3);
    expect(res.states[0].itemCount).toBe(3);
  });
});

describe('fetchExportsIntoMarketCount', () => {
  it('reads the total from the export_only inventory-items list with limit=1', async () => {
    publicApiGet.mockResolvedValue({ success: true, data: { items: [{}], total: 86 } });
    await expect(fetchExportsIntoMarketCount('CM')).resolves.toBe(86);
    expect(publicApiGet).toHaveBeenCalledWith(
      '/inventory-items',
      { export_only: 'true', country_code: 'CM', limit: 1 },
      undefined
    );
  });

  it('returns 0 for a market with no exports', async () => {
    publicApiGet.mockResolvedValue({ success: true, data: { items: [], total: 0 } });
    await expect(fetchExportsIntoMarketCount('CA')).resolves.toBe(0);
  });

  it('rejects when the payload has no total, so the strip hides instead of showing 0', async () => {
    publicApiGet.mockResolvedValue({ success: true, data: {} });
    await expect(fetchExportsIntoMarketCount('CM')).rejects.toThrow();
  });
});

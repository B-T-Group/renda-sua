import { beforeEach, describe, expect, it, vi } from 'vitest';

const publicApiGet = vi.fn();
vi.mock('./publicApiClient', () => ({
  publicApiGet: (...args: unknown[]) => publicApiGet(...args),
}));

import { exportSellersPath, fetchExportSellers } from './inventoryItemsApi';

const into = { direction: 'into' as const, marketCode: 'CM', originCode: null, limit: 10 };
const caSeller = {
  business_location_id: 'ca-1',
  name: 'Rendasua Canada - 1TRACK',
  country: 'CA',
  city: 'London',
  item_count: 2,
};

describe('fetchExportSellers', () => {
  beforeEach(() => publicApiGet.mockReset());

  it('carousel, count, and See all share export_only + country_code on Into', () => {
    expect(exportSellersPath(into)).toBe(
      '/inventory-items/stores?export_only=true&limit=10&country_code=CM'
    );
    expect(exportSellersPath({ ...into, limit: 30 })).toContain('export_only=true');
    expect(exportSellersPath({ ...into, limit: 30 })).toContain('country_code=CM');
  });

  it('ignores a legacy local-directory payload (the DEV Into-Cameroon bug)', async () => {
    publicApiGet.mockResolvedValue({
      success: true,
      data: {
        stores: [
          { business_location_id: '1', name: 'Happy store - Yaoundé', city: 'Yaoundé' },
          { business_location_id: '2', name: 'Home cake - Douala', city: 'Douala' },
          { business_location_id: '3', name: 'MM Rail - Yaoundé', city: 'Yaoundé' },
        ],
      },
    });
    const page = await fetchExportSellers(into);
    expect(publicApiGet).toHaveBeenCalledWith(
      '/inventory-items/stores?export_only=true&limit=10&country_code=CM',
      undefined,
      undefined
    );
    expect(page).toEqual({ stores: [], total: 0, country: null });
  });

  it('returns origin-country sellers from a valid export envelope', async () => {
    publicApiGet.mockResolvedValue({
      success: true,
      data: { stores: [caSeller], total: 9, country: 'CM' },
    });
    const page = await fetchExportSellers(into);
    expect(page.total).toBe(9);
    expect(page.stores).toEqual([caSeller]);
  });

  it('rejects an Into payload that includes destination-country sellers', async () => {
    publicApiGet.mockResolvedValue({
      success: true,
      data: {
        stores: [caSeller, { ...caSeller, business_location_id: 'cm-1', name: 'Happy store - Yaoundé', country: 'CM' }],
        total: 2,
        country: 'CM',
      },
    });
    expect(await fetchExportSellers(into)).toEqual({ stores: [], total: 0, country: null });
  });
});

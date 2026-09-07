import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { CartLine } from '../types/cart';

// Minimal mock for AsyncStorage so CartStore can be constructed.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(null),
  },
}));

// Dynamic import so the mock is in place before the module loads.
async function makeStore() {
  const { CartStore } = await import('./CartStore');
  return new CartStore();
}

function makeLine(overrides: Partial<CartLine> = {}): CartLine {
  return {
    inventoryItemId: 'inv-1',
    quantity: 1,
    businessId: 'biz-1',
    businessLocationId: 'loc-1',
    itemData: {
      name: 'Product',
      price: 1000,
      currency: 'XAF',
    },
    ...overrides,
  };
}

describe('CartStore.countryInfo', () => {
  it('returns unknown for an empty cart', async () => {
    const store = await makeStore();
    expect(store.countryInfo.status).toBe('unknown');
    expect(store.countryInfo.countries).toHaveLength(0);
  });

  it('returns ok when all lines have the same country', async () => {
    const store = await makeStore();
    store.items = [
      makeLine({ inventoryItemId: 'inv-1', sellerCountry: 'CM' }),
      makeLine({ inventoryItemId: 'inv-2', sellerCountry: 'CM' }),
    ];
    const info = store.countryInfo;
    expect(info.status).toBe('ok');
    expect(info.countries).toEqual(['CM']);
    expect(info.hasStalLines).toBe(false);
  });

  it('returns mixed_countries when lines span multiple countries', async () => {
    const store = await makeStore();
    store.items = [
      makeLine({ inventoryItemId: 'inv-1', sellerCountry: 'CM' }),
      makeLine({ inventoryItemId: 'inv-2', sellerCountry: 'CA' }),
    ];
    const info = store.countryInfo;
    expect(info.status).toBe('mixed_countries');
    expect(info.countries).toContain('CM');
    expect(info.countries).toContain('CA');
  });

  it('returns stale_metadata when any line is missing sellerCountry', async () => {
    const store = await makeStore();
    store.items = [
      makeLine({ inventoryItemId: 'inv-1', sellerCountry: 'CM' }),
      makeLine({ inventoryItemId: 'inv-2' }), // no sellerCountry - pre-migration line
    ];
    const info = store.countryInfo;
    expect(info.status).toBe('stale_metadata');
    expect(info.hasStalLines).toBe(true);
  });

  it('returns stale_metadata when ALL lines are missing sellerCountry', async () => {
    const store = await makeStore();
    store.items = [makeLine(), makeLine({ inventoryItemId: 'inv-2' })];
    expect(store.countryInfo.status).toBe('stale_metadata');
  });
});

describe('CartStore.hasCheckoutBlockingCountryIssue', () => {
  it('is true for mixed_countries', async () => {
    const store = await makeStore();
    store.items = [
      makeLine({ sellerCountry: 'CM' }),
      makeLine({ inventoryItemId: 'inv-2', sellerCountry: 'CA' }),
    ];
    expect(store.hasCheckoutBlockingCountryIssue).toBe(true);
  });

  it('is true for stale_metadata', async () => {
    const store = await makeStore();
    store.items = [makeLine()]; // missing sellerCountry
    expect(store.hasCheckoutBlockingCountryIssue).toBe(true);
  });

  it('is false for a valid single-country cart', async () => {
    const store = await makeStore();
    store.items = [makeLine({ sellerCountry: 'CM' })];
    expect(store.hasCheckoutBlockingCountryIssue).toBe(false);
  });
});

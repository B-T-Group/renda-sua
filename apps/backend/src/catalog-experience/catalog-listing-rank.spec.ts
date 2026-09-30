import type { InventoryItem } from '../inventory-items/inventory-items.service';
import { listingRankSignals, rankListings } from './catalog-listing-rank';

function listing(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'inv-1',
    item_id: 'item-1',
    computed_available_quantity: 4,
    viewsCount: 10,
    hasActiveDeal: false,
    created_at: '2026-09-30T00:00:00.000Z',
    ...overrides,
  } as InventoryItem;
}

describe('listing rank signals', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-30T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('drops the local signal at 50km and when distance is missing', () => {
    expect(listingRankSignals(listing({ distance_value: 0 })).local).toBe(1);
    expect(listingRankSignals(listing({ distance_value: 25_000 })).local).toBe(0.5);
    expect(listingRankSignals(listing({ distance_value: 50_000 })).local).toBe(0);
    expect(listingRankSignals(listing({ distance_value: 80_000 })).local).toBe(0);
    expect(listingRankSignals(listing()).local).toBe(0);
  });

  it('treats a new listing as fresh and one older than 30 days as stale', () => {
    const today = listingRankSignals(
      listing({ created_at: '2026-09-30T00:00:00.000Z' })
    );
    const mid = listingRankSignals(
      listing({ created_at: '2026-09-15T00:00:00.000Z' })
    );
    const stale = listingRankSignals(
      listing({ created_at: '2026-08-01T00:00:00.000Z' })
    );
    expect(today.freshness).toBe(1);
    expect(mid.freshness).toBeCloseTo(0.5);
    expect(stale.freshness).toBe(0);
    expect(listingRankSignals(listing({ created_at: 'not-a-date' })).freshness).toBe(0);
  });

  it('withholds the inventory signal when nothing is available to sell', () => {
    expect(listingRankSignals(listing({ computed_available_quantity: 0 })).inventory).toBe(0);
    expect(listingRankSignals(listing({ computed_available_quantity: 3 })).inventory).toBe(1);
  });

  it('ranks in-stock nearby stock ahead of a distant sold-out listing', () => {
    const nearby = listing({
      id: 'near',
      item_id: 'near',
      distance_value: 1_000,
      computed_available_quantity: 2,
      viewsCount: 1,
    });
    const distant = listing({
      id: 'far',
      item_id: 'far',
      distance_value: 80_000,
      computed_available_quantity: 0,
      viewsCount: 1,
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(rankListings([distant, nearby], 1).map((row) => row.id)).toEqual(['near']);
  });
});

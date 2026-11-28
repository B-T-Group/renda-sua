import {
  activeBrowseLane,
  BROWSE_LANES,
  isBrowseLanePathActive,
} from './browseMarketLanes';

describe('BROWSE_LANES', () => {
  it('lists all four lanes in order with paths', () => {
    const items = BROWSE_LANES;
    expect(items.map((item) => item.key)).toEqual([
      'rentals',
      'exports',
      'shop',
      'food',
    ]);
    expect(items.map((item) => item.path)).toEqual([
      '/rentals',
      '/exports',
      '/items',
      '/foods',
    ]);
  });
});

describe('isBrowseLanePathActive', () => {
  it('matches exact and nested paths', () => {
    expect(isBrowseLanePathActive('/exports', '/exports')).toBe(true);
    expect(isBrowseLanePathActive('/exports/foo', '/exports')).toBe(true);
    expect(isBrowseLanePathActive('/items', '/exports')).toBe(false);
  });
});

describe('activeBrowseLane', () => {
  it('prefers the lane path', () => {
    expect(activeBrowseLane('/rentals', 'rentals')).toBe('rentals');
    expect(activeBrowseLane('/exports/CA', 'inventory')).toBe('exports');
    expect(activeBrowseLane('/items/abc', 'inventory')).toBe('shop');
    expect(activeBrowseLane('/foods', 'inventory')).toBe('food');
  });

  it('falls back to the catalog for other pages and nothing for the rest', () => {
    expect(activeBrowseLane('/stores', 'inventory')).toBe('shop');
    expect(activeBrowseLane('/rental-listings/1', 'rentals')).toBe('rentals');
    expect(activeBrowseLane('/', 'all')).toBeNull();
  });
});

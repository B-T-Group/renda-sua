import { BROWSE_LANES, isBrowseLanePathActive } from './browseMarketLanes';

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

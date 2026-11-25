import { browseLaneNavItems, isBrowseLanePathActive } from './browseMarketLanes';

describe('browseLaneNavItems', () => {
  it('maps visible lanes in order with paths', () => {
    const items = browseLaneNavItems(['rentals', 'exports', 'shop', 'food']);
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

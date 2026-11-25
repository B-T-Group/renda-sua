import { visibleMarketLanes } from './market-lanes.types';

describe('visibleMarketLanes', () => {
  it('returns lanes in Rentals → Exports → Shop → Food order', () => {
    expect(
      visibleMarketLanes({
        rentals: true,
        exports: true,
        shop: true,
        food: true,
      })
    ).toEqual(['rentals', 'exports', 'shop', 'food']);
  });

  it('omits hidden lanes while preserving order', () => {
    expect(
      visibleMarketLanes({
        rentals: false,
        exports: true,
        shop: false,
        food: true,
      })
    ).toEqual(['exports', 'food']);
  });

  it('returns an empty list when nothing is available', () => {
    expect(
      visibleMarketLanes({
        rentals: false,
        exports: false,
        shop: false,
        food: false,
      })
    ).toEqual([]);
  });
});

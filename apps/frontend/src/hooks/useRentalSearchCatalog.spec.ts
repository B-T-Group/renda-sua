import { appendCatalogHits, catalogHasMore, type RentalSearchCatalogHit } from './useRentalSearchCatalog';

function hit(id: string): RentalSearchCatalogHit {
  return {
    listing: { id } as RentalSearchCatalogHit['listing'],
    available: null,
    nextAvailableDate: null,
    pricePerDay: 1,
    totalForDates: null,
    dayCount: null,
  };
}

describe('catalogHasMore', () => {
  const row = [{}];

  it('stops on an empty page or an explicit false, even when the total is still larger', () => {
    expect(catalogHasMore({ listings: [], hasMore: true, total: 50 }, 0)).toBe(false);
    expect(catalogHasMore({ listings: row, hasMore: false, total: 50 }, 1)).toBe(false);
    expect(catalogHasMore({ listings: row, hasMore: true, total: 1 }, 1)).toBe(true);
    expect(catalogHasMore({ listings: row, total: 20 }, 20)).toBe(false);
    expect(catalogHasMore({ listings: row, total: 20 }, 1)).toBe(true);
  });
});

describe('appendCatalogHits', () => {
  it('keeps the first copy of a listing when the next page repeats it', () => {
    expect(appendCatalogHits([hit('a')], [hit('b'), hit('a'), hit('b')]).map((row) => row.listing.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

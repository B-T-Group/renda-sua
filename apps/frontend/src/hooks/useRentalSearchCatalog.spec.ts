import { appendCatalogHits, type RentalSearchCatalogHit } from './useRentalSearchCatalog';

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

describe('appendCatalogHits', () => {
  it('keeps the first copy of a listing when the next page repeats it', () => {
    expect(appendCatalogHits([hit('a')], [hit('b'), hit('a'), hit('b')]).map((row) => row.listing.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

import { formatCatalogMoney } from './rentalRequestFormat';
import { defaultCatalogParams, mergeSearchHits } from './defaultRentalCatalog';

describe('default rental catalog', () => {
  it('asks for the market with no query and pages of 20', () => {
    expect(
      defaultCatalogParams({
        country: 'CM',
        state: 'LT',
        query: '  ',
        categoryId: null,
        dates: null,
        sort: 'recommended',
        page: 1,
      })
    ).toEqual({
      q: undefined,
      country_code: 'CM',
      state: 'LT',
      category_id: undefined,
      sort: 'recommended',
      start_date: undefined,
      end_date: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('replaces the first page and appends the next without repeating a listing', () => {
    const hit = (id: string) => ({ listing: { id } });
    expect(mergeSearchHits([hit('a')], [hit('b')], 1)).toEqual([hit('b')]);
    expect(mergeSearchHits([hit('a')], [hit('b')], 2)).toEqual([hit('a'), hit('b')]);
    expect(mergeSearchHits([hit('a')], [hit('a'), hit('c')], 2)).toEqual([hit('a'), hit('c')]);
  });

  it('formats XAF with a non-breaking space and CAD for EN and FR', () => {
    expect(formatCatalogMoney(45000, 'XAF', 'en')).toBe('45\u00A0000\u00A0FCFA');
    expect(formatCatalogMoney(45000, 'XAF', 'fr')).toBe('45\u00A0000\u00A0FCFA');
    expect(formatCatalogMoney(45, 'CAD', 'en')).toBe('$45.00');
    expect(formatCatalogMoney(45, 'CAD', 'fr')).toBe('45,00\u00A0$');
  });
});
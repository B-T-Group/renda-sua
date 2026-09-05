import { catalogGeoQueryParams } from './useCatalogGeoParams';

describe('catalogGeoQueryParams', () => {
  it('returns empty params until the market is ready', () => {
    expect(catalogGeoQueryParams({ ready: false })).toEqual({});
  });

  it('includes country and optional state when ready', () => {
    expect(
      catalogGeoQueryParams({
        ready: true,
        country_code: 'CM',
        state: 'Littoral',
      })
    ).toEqual({ country_code: 'CM', state: 'Littoral' });
  });

  it('omits state when browsing the whole country', () => {
    expect(
      catalogGeoQueryParams({ ready: true, country_code: 'CA' })
    ).toEqual({ country_code: 'CA' });
  });
});

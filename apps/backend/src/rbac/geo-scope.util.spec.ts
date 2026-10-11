import {
  addressGeoWhere,
  orderGeoWhere,
  scopeCovers,
  type MarketRow,
} from './geo-scope.util';

const MARKETS: MarketRow[] = [
  { countryCode: 'CM', countryName: 'Cameroon', stateName: 'Littoral', stateKey: 'littoral' },
  { countryCode: 'CM', countryName: 'Cameroon', stateName: 'Centre', stateKey: 'centre' },
];

describe('scopeCovers', () => {
  const littoral = {
    all: false as const,
    countries: [],
    states: [{ countryCode: 'CM', stateKey: 'littoral' }],
  };

  it('matches a state after suffix and accent normalization', () => {
    expect(scopeCovers(littoral, { countryCode: 'Cameroon', stateName: 'Littoral Region' }, MARKETS)).toBe(true);
    expect(scopeCovers(littoral, { countryCode: 'CM', stateName: 'Centre' }, MARKETS)).toBe(false);
  });

  it('lets a country grant cover every state', () => {
    const country = { all: false as const, countries: ['CM'], states: [] };
    expect(scopeCovers(country, { countryCode: 'CM', stateName: 'Centre' }, MARKETS)).toBe(true);
  });
});

describe('address and order filters', () => {
  const scope = { all: false as const, countries: ['CM'], states: [] };

  it('matches the ISO code or the country name', () => {
    expect(addressGeoWhere(scope, MARKETS)).toEqual({
      _or: [{ country: { _ilike: 'CM' } }, { country: { _ilike: 'Cameroon' } }],
    });
  });

  it('filters orders on the shop address and falls back to delivery', () => {
    const where = orderGeoWhere(scope, MARKETS);
    expect(where?._or?.[0]).toEqual({
      business_location: { address: addressGeoWhere(scope, MARKETS) },
    });
    expect(JSON.stringify(where)).toContain('delivery_address');
  });
});

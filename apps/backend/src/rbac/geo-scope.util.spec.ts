import {
  addressGeoWhere,
  andWhere,
  businessGeoWhere,
  countryInScope,
  creditGeoWhere,
  orderGeoWhere,
  personaGeoWhere,
  resolveCountryCode,
  scopeCovers,
  stateInScope,
  type MarketRow,
} from './geo-scope.util';

const MARKETS: MarketRow[] = [
  { countryCode: 'CM', countryName: 'Cameroon', stateName: 'Littoral', stateKey: 'littoral' },
  { countryCode: 'CM', countryName: 'Cameroon', stateName: 'Centre', stateKey: 'centre' },
];

describe('resolveCountryCode', () => {
  it('matches a code or an exact country name and rejects anything else', () => {
    expect(resolveCountryCode('  cameroon ', MARKETS)).toBe('CM');
    expect(resolveCountryCode('cm', MARKETS)).toBe('CM');
    expect(resolveCountryCode('ZZ', MARKETS)).toBe('ZZ');
    expect(resolveCountryCode('Cameroun', MARKETS)).toBeNull();
    expect(resolveCountryCode('Narnia', MARKETS)).toBeNull();
    expect(resolveCountryCode('   ', MARKETS)).toBeNull();
    expect(resolveCountryCode(null, MARKETS)).toBeNull();
  });
});

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

  it('fails closed when the country or the state cannot be resolved', () => {
    expect(scopeCovers({ all: true }, { countryCode: null }, MARKETS)).toBe(true);
    const country = { all: false as const, countries: ['CM'], states: [] };
    expect(scopeCovers(country, { countryCode: '  ' }, MARKETS)).toBe(false);
    expect(scopeCovers(country, { countryCode: 'Narnia' }, MARKETS)).toBe(false);
    expect(scopeCovers(littoral, { countryCode: 'Cameroon' }, MARKETS)).toBe(false);
    expect(scopeCovers(littoral, { countryCode: 'ZZ' }, MARKETS)).toBe(false);
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

  it('returns no filter for a global scope and an impossible filter for an empty one', () => {
    expect(addressGeoWhere({ all: true }, MARKETS)).toBeNull();
    expect(orderGeoWhere({ all: true }, MARKETS)).toBeNull();
    expect(addressGeoWhere({ all: false, countries: [], states: [] }, MARKETS)).toEqual({
      id: { _is_null: true },
    });
  });

  it('limits a state grant to that state and drops states already covered by a country', () => {
    const littoral = {
      all: false as const,
      countries: ['GA'],
      states: [
        { countryCode: 'CM', stateKey: 'littoral' },
        { countryCode: 'GA', stateKey: 'estuaire' },
      ],
    };
    expect(addressGeoWhere(littoral, MARKETS)).toEqual({
      _or: [
        { _or: [{ country: { _ilike: 'GA' } }] },
        {
          _and: [
            { _or: [{ country: { _ilike: 'CM' } }, { country: { _ilike: 'Cameroon' } }] },
            { state_key: { _in: ['littoral'] } },
          ],
        },
      ],
    });
  });
});

describe('persona, business, and credit filters', () => {
  const country = { all: false as const, countries: ['CM'], states: [] };
  const littoral = {
    all: false as const,
    countries: [] as string[],
    states: [{ countryCode: 'CM', stateKey: 'littoral' }],
  };

  it('adds the user country only for a whole-country grant', () => {
    expect(personaGeoWhere(country, MARKETS, ['client_addresses'])).toEqual({
      _or: [
        { client_addresses: { address: addressGeoWhere(country, MARKETS) } },
        { user: { country: { _in: ['CM'] } } },
      ],
    });
    expect(personaGeoWhere(littoral, MARKETS, ['agent_addresses'])).toEqual({
      agent_addresses: { address: addressGeoWhere(littoral, MARKETS) },
    });
    expect(personaGeoWhere({ all: true }, MARKETS, ['client_addresses'])).toBeNull();
  });

  it('wraps businesses in their locations', () => {
    expect(businessGeoWhere(country, MARKETS)).toEqual({
      business_locations: { address: addressGeoWhere(country, MARKETS) },
    });
    expect(businessGeoWhere({ all: true }, MARKETS)).toBeNull();
  });

  it('shows orderless credits for a country grant and hides them from a state grant', () => {
    expect(creditGeoWhere({ all: true }, MARKETS)).toBeNull();
    expect(creditGeoWhere(littoral, MARKETS)).toEqual({
      order: orderGeoWhere(littoral, MARKETS),
    });
    expect(creditGeoWhere(country, MARKETS)).toEqual({
      _or: [
        { order: orderGeoWhere(country, MARKETS) },
        {
          _and: [
            { order_id: { _is_null: true } },
            { user: { country: { _in: ['CM'] } } },
          ],
        },
      ],
    });
  });
});

describe('scope membership', () => {
  const littoral = {
    all: false as const,
    countries: [] as string[],
    states: [{ countryCode: 'CM', stateKey: 'littoral' }],
  };

  it('treats a state grant as membership in that country only', () => {
    expect(countryInScope({ all: true }, 'GA')).toBe(true);
    expect(countryInScope(littoral, 'CM')).toBe(true);
    expect(countryInScope(littoral, 'GA')).toBe(false);
    expect(stateInScope({ all: false, countries: ['CM'], states: [] }, 'CM', null)).toBe(true);
    expect(stateInScope(littoral, 'CM', null)).toBe(false);
    expect(stateInScope(littoral, 'CM', 'Littoral Region')).toBe(true);
    expect(stateInScope(littoral, 'CM', 'Centre')).toBe(false);
  });

  it('combines filters and drops an empty side', () => {
    expect(andWhere({ id: { _eq: '1' } }, null)).toEqual({ id: { _eq: '1' } });
    expect(andWhere({ id: { _eq: '1' } }, {})).toEqual({ id: { _eq: '1' } });
    expect(andWhere({}, { country: { _eq: 'CM' } })).toEqual({ country: { _eq: 'CM' } });
    expect(andWhere({ active: { _eq: true } }, { country: { _eq: 'CM' } })).toEqual({
      _and: [{ active: { _eq: true } }, { country: { _eq: 'CM' } }],
    });
  });
});

import {
  exportDestinationCodes,
  exportOriginCode,
  exportViewerRole,
  formatExportDestinations,
  isExportOnlyItem,
} from './exportItemRules';
import {
  exportCountryName,
  exportCountryOfPlace,
  exportCountryPlace,
  normalizeCountryCode,
} from './exportCountries';

const maple = {
  item: {
    export_available: true,
    export_markets: [{ country_code: 'ga' }, { country_code: 'CM' }, { country_code: 'CM' }],
  },
  business_location: { address: { country: 'CA' } },
};

describe('exportItemRules', () => {
  it('reads destinations (unique, sorted, upper) and the origin', () => {
    expect(isExportOnlyItem(maple)).toBe(true);
    expect(isExportOnlyItem({ item: { export_available: false } })).toBe(false);
    expect(exportDestinationCodes(maple)).toEqual(['CM', 'GA']);
    expect(exportOriginCode(maple)).toBe('CA');
  });

  it('splits viewers into destination, origin and third market', () => {
    expect(exportViewerRole(maple, 'cm')).toBe('destination');
    expect(exportViewerRole(maple, 'CA')).toBe('origin');
    expect(exportViewerRole(maple, 'SN')).toBe('third');
    expect(exportViewerRole(maple, null)).toBe('third');
  });

  it('a market that is both origin and destination is a destination', () => {
    const both = { ...maple, business_location: { address: { country: 'GA' } } };
    expect(exportViewerRole(both, 'GA')).toBe('destination');
  });

  it('formats the destinations line', () => {
    expect(formatExportDestinations(['CM', 'GA'])).toBe('CM · GA');
    expect(formatExportDestinations(['CD', 'CG', 'CI', 'CM', 'GA'])).toBe('CD · CG · CI +2');
  });
});

describe('exportCountries', () => {
  it('names countries with the right French article', () => {
    expect(exportCountryName('CM', 'en')).toBe('Cameroon');
    expect(exportCountryName('CM', 'fr')).toBe('Cameroun');
    expect(exportCountryPlace('CA', 'fr')).toBe('le Canada');
    expect(exportCountryPlace('CI', 'fr')).toBe('la Côte d’Ivoire');
    expect(exportCountryPlace('PH', 'fr')).toBe('les Philippines');
    expect(exportCountryOfPlace('CA', 'fr')).toBe('du Canada');
    expect(exportCountryOfPlace('CD', 'fr')).toBe('de la RD Congo');
    expect(exportCountryOfPlace('US', 'fr')).toBe('des États-Unis');
    expect(exportCountryPlace('CA', 'en')).toBe('Canada');
  });

  it('validates codes', () => {
    expect(normalizeCountryCode(' ca ')).toBe('CA');
    expect(normalizeCountryCode('can')).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});

import {
  mapCountryToMobileMoneyProvider,
  resolveItemCountry,
} from './item-country.util';

describe('resolveItemCountry', () => {
  it('prefers the item location country over the owner country', () => {
    expect(resolveItemCountry('cm', 'GA')).toBe('CM');
  });

  it('falls back to the owner country when the location has none', () => {
    expect(resolveItemCountry(null, ' ga ')).toBe('GA');
    expect(resolveItemCountry('', 'CM')).toBe('CM');
  });

  it('returns null when neither country is present', () => {
    expect(resolveItemCountry(undefined, null)).toBeNull();
  });
});

describe('mapCountryToMobileMoneyProvider', () => {
  it('maps Cameroon to Freemopay', () => {
    expect(mapCountryToMobileMoneyProvider('cm')).toBe('freemopay');
    expect(mapCountryToMobileMoneyProvider('CM')).toBe('freemopay');
  });

  it('maps Gabon and unknown markets to MyPVit', () => {
    expect(mapCountryToMobileMoneyProvider('GA')).toBe('mypvit');
    expect(mapCountryToMobileMoneyProvider('CA')).toBe('mypvit');
    expect(mapCountryToMobileMoneyProvider(undefined)).toBe('mypvit');
  });
});

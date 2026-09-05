import {
  getDialCodeForActiveCountry,
  isActivePhoneCountry,
} from './activeCountries';

describe('isActivePhoneCountry', () => {
  it('accepts the new CFA markets and existing rails', () => {
    expect(isActivePhoneCountry('TG')).toBe(true);
    expect(isActivePhoneCountry(' bj ')).toBe(true);
    expect(isActivePhoneCountry('ci')).toBe(true);
    expect(isActivePhoneCountry('CG')).toBe(true);
    expect(isActivePhoneCountry('CM')).toBe(true);
    expect(isActivePhoneCountry('CA')).toBe(true);
    expect(isActivePhoneCountry('FR')).toBe(false);
    expect(isActivePhoneCountry('')).toBe(false);
  });
});

describe('getDialCodeForActiveCountry', () => {
  it('returns the ITU dial codes for the new CFA markets', () => {
    expect(getDialCodeForActiveCountry('TG')).toBe('228');
    expect(getDialCodeForActiveCountry('BJ')).toBe('229');
    expect(getDialCodeForActiveCountry('CI')).toBe('225');
    expect(getDialCodeForActiveCountry('CG')).toBe('242');
  });

  it('returns null when the country is not an active phone market', () => {
    expect(getDialCodeForActiveCountry('FR')).toBeNull();
    expect(getDialCodeForActiveCountry(null)).toBeNull();
  });
});

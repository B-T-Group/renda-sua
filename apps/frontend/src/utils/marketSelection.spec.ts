import { MARKET_STORAGE_KEY, type Market } from '../types/market';
import {
  applyAutoDetectedCountry,
  buildSelectedMarket,
} from './marketSelection';

const cameroon: Market = {
  id: 'CM',
  code: 'CM',
  countryCode: 'CM',
  stateCode: null,
  stateName: null,
  name: 'Cameroon',
  currency: 'XAF',
  flag: '🇨🇲',
  isEnabled: true,
};

describe('buildSelectedMarket', () => {
  it('composes a state id from a known country', () => {
    const actual = buildSelectedMarket([cameroon], 'CM', 'LT');

    expect(actual).toEqual({
      ...cameroon,
      stateCode: 'LT',
      stateName: 'LT',
      id: 'CM:LT',
    });
  });

  it('synthesizes an unknown country without inventing a state', () => {
    const actual = buildSelectedMarket([], 'GA', null);

    expect(actual).toEqual({
      id: 'GA',
      code: 'GA',
      countryCode: 'GA',
      stateCode: null,
      stateName: null,
      name: 'GA',
      currency: '',
      flag: 'GA',
      isEnabled: true,
    });
  });
});

describe('applyAutoDetectedCountry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('ignores unsupported or empty codes and does not persist', () => {
    const setCountryCode = jest.fn();
    const setStateCode = jest.fn();

    applyAutoDetectedCountry('ZZ', ['CM', 'CA'], setCountryCode, setStateCode);
    applyAutoDetectedCountry('', ['CM'], setCountryCode, setStateCode);
    applyAutoDetectedCountry(null, ['CM'], setCountryCode, setStateCode);

    expect(setCountryCode).not.toHaveBeenCalled();
    expect(setStateCode).not.toHaveBeenCalled();
    expect(localStorage.getItem(MARKET_STORAGE_KEY)).toBeNull();
  });

  it('applies a supported ISO, clears state, and stores AUTO mode', () => {
    const setCountryCode = jest.fn();
    const setStateCode = jest.fn();

    applyAutoDetectedCountry('ca', ['CM', 'CA'], setCountryCode, setStateCode);

    expect(setCountryCode).toHaveBeenCalledWith('CA');
    expect(setStateCode).toHaveBeenCalledWith(null);
    expect(JSON.parse(localStorage.getItem(MARKET_STORAGE_KEY) ?? '{}')).toEqual({
      countryCode: 'CA',
      stateCode: null,
      mode: 'AUTO',
    });
  });
});

import { CURRENCIES } from '../constants/enums';
import { resolveCurrencyForCountry } from './resolveCurrencyForCountry';

describe('resolveCurrencyForCountry', () => {
  it('locks West African CFA markets to XOF and Central African ones to XAF', () => {
    expect(resolveCurrencyForCountry('TG', [])).toBe('XOF');
    expect(resolveCurrencyForCountry('bj', [])).toBe('XOF');
    expect(resolveCurrencyForCountry('CI', [])).toBe('XOF');
    expect(resolveCurrencyForCountry('CG', [])).toBe('XAF');
    expect(resolveCurrencyForCountry('CM', [])).toBe('XAF');
    expect(CURRENCIES).toContain('XOF');
  });

  it('prefers the supported-country currency when present', () => {
    expect(
      resolveCurrencyForCountry('TG', [{ code: 'TG', currencyCode: 'xof' }])
    ).toBe('XOF');
    expect(
      resolveCurrencyForCountry('CA', [{ code: 'CA', currencyCode: 'CAD' }])
    ).toBe('CAD');
  });

  it('falls back to CAD, USD, or XAF when the catalog has no currency', () => {
    expect(resolveCurrencyForCountry('CA', [])).toBe('CAD');
    expect(resolveCurrencyForCountry('US', [])).toBe('USD');
    expect(resolveCurrencyForCountry('', [])).toBe('XAF');
    expect(resolveCurrencyForCountry('FR', [])).toBe('XAF');
  });
});

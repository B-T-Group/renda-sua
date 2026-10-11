import { comparableCountry } from './delivery-pricing.util';

describe('comparableCountry', () => {
  it('keeps ISO codes, ignoring case and space', () => {
    expect(comparableCountry(' cm ')).toBe('CM');
    expect(comparableCountry('CA')).toBe('CA');
  });

  it('maps known English names (any casing) to their ISO code', () => {
    expect(comparableCountry('Cameroon')).toBe('CM');
    expect(comparableCountry('  gabon ')).toBe('GA');
    expect(comparableCountry('CANADA')).toBe('CA');
    expect(comparableCountry('Congo')).toBe('CG');
    expect(comparableCountry("Cote d'Ivoire")).toBe('CI');
  });

  it('keeps Canada and Cameroon distinct (name or code on either side)', () => {
    expect(comparableCountry('Canada')).not.toBe(comparableCountry('Cameroon'));
    expect(comparableCountry('Canada')).toBe(comparableCountry('CA'));
    expect(comparableCountry('Cameroon')).toBe(comparableCountry('cm'));
  });

  it('returns null for blank and leaves unknown text as entered (never matches an ISO code)', () => {
    expect(comparableCountry(null)).toBeNull();
    expect(comparableCountry('   ')).toBeNull();
    expect(comparableCountry('Narnia')).toBe('NARNIA');
    expect(comparableCountry('Cameroun')).toBe('CAMEROUN');
  });
});

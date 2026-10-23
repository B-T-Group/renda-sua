import {
  comparableCountry,
  isoCountryCode,
  normalizeDeliveryCountryCode,
} from './delivery-pricing.util';

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
    expect(comparableCountry('RDC')).toBe('CD');
    expect(comparableCountry('Democratic Republic of the Congo')).toBe('CD');
    expect(normalizeDeliveryCountryCode('RDC')).toBe('CD');
    expect(comparableCountry("Cote d'Ivoire")).toBe('CI');
  });

  it('maps French Cameroon to CM, never to Canada', () => {
    expect(comparableCountry('Cameroun')).toBe('CM');
    expect(comparableCountry('  cameroun ')).toBe('CM');
    expect(comparableCountry('Cameroun')).toBe(comparableCountry('CM'));
    expect(comparableCountry('Cameroun')).not.toBe(comparableCountry('Canada'));
    expect(normalizeDeliveryCountryCode('Cameroun')).toBe('CM');
    expect(normalizeDeliveryCountryCode('Cameroun')).not.toBe('CA');
    expect(isoCountryCode('Cameroun')).toBe('CM');
    expect(isoCountryCode('Cameroon')).toBe('CM');
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
    expect(isoCountryCode('Narnia')).toBeNull();
    expect(isoCountryCode(null)).toBeNull();
  });
});

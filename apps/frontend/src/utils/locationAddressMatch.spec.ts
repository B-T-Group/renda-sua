import { lookupCommonGeocodeCountry } from './locationAddressMatch';

describe('lookupCommonGeocodeCountry', () => {
  it('maps new CFA market aliases to ISO codes', () => {
    expect(lookupCommonGeocodeCountry('Ivory Coast')).toBe('CI');
    expect(lookupCommonGeocodeCountry("Cote d'Ivoire")).toBe('CI');
    expect(lookupCommonGeocodeCountry("Cote d'Ivoire (Ivory Coast)")).toBe('CI');
    expect(lookupCommonGeocodeCountry('Togo')).toBe('TG');
    expect(lookupCommonGeocodeCountry('Benin')).toBe('BJ');
    expect(lookupCommonGeocodeCountry('Congo')).toBe('CG');
    expect(lookupCommonGeocodeCountry('Congo-Brazzaville')).toBe('CG');
    expect(lookupCommonGeocodeCountry('Republic of the Congo')).toBe('CG');
  });

  it('keeps DRC distinct from Congo-Brazzaville', () => {
    expect(lookupCommonGeocodeCountry('Democratic Republic of the Congo')).toBe(
      'CD'
    );
    expect(lookupCommonGeocodeCountry('DRC')).toBe('CD');
    expect(lookupCommonGeocodeCountry('congo brazzaville')).toBe('CG');
  });

  it('returns empty for blank or unknown labels', () => {
    expect(lookupCommonGeocodeCountry('')).toBe('');
    expect(lookupCommonGeocodeCountry('   ')).toBe('');
    expect(lookupCommonGeocodeCountry(null)).toBe('');
    expect(lookupCommonGeocodeCountry('Atlantis')).toBe('');
  });
});

import { getCountryCodeFromE164, nationalDigitsToE164 } from './phoneUtils';

describe('getCountryCodeFromE164', () => {
  it.each([
    ['+237612345678', 'CM'],
    ['+241062345678', 'GA'],
    ['+22878123456', 'TG'],
    ['+228', 'TG'],
    // 228 later in the number must not steal the rail from Cameroon or Gabon
    ['+237228999999', 'CM'],
    ['+241228999999', 'GA'],
    ['+228237000000', 'TG'],
    ['22878123456', null],
    [' +22878123456', null],
    ['', null],
    ['+', null],
    ['+1', null],
    ['+22578123456', null],
    ['+22', null],
    ['+23', null],
    ['+24', null],
  ] as const)('%p -> %p', (phone, country) => {
    expect(getCountryCodeFromE164(phone)).toBe(country);
  });

  it('treats a missing value as unrecognized', () => {
    expect(getCountryCodeFromE164(undefined as unknown as string)).toBeNull();
  });
});

describe('nationalDigitsToE164', () => {
  it('prefixes Togo national digits, including a lowercase country code', () => {
    expect(nationalDigitsToE164('90 12 34 56', 'tg')).toBe('+22890123456');
    expect(nationalDigitsToE164('90123456', 'TG')).toBe('+22890123456');
  });

  it('does not double-prefix a number that already includes the country code', () => {
    expect(nationalDigitsToE164('22890123456', 'TG')).toBe('+22890123456');
    expect(nationalDigitsToE164('237612345678', 'CM')).toBe('+237612345678');
    expect(nationalDigitsToE164('24106234567', 'GA')).toBe('+24106234567');
  });

  it('still prefixes Cameroon and Gabon national numbers', () => {
    expect(nationalDigitsToE164('6 12 34 56 78', 'CM')).toBe('+237612345678');
    expect(nationalDigitsToE164('06234567', 'GA')).toBe('+24106234567');
  });

  it('rejects an unsupported country and a number with no digits', () => {
    expect(() => nationalDigitsToE164('90123456', 'FR')).toThrow(
      'Unsupported country code for phone normalization: FR'
    );
    expect(() => nationalDigitsToE164('abc', 'TG')).toThrow(
      'Phone number contains no digits'
    );
  });
});

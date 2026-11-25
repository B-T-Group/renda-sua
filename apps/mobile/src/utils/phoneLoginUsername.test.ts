import type { CountryCode } from 'libphonenumber-js';
import { formatStoredPhone, seedPhoneInputFromE164 } from './phoneLoginUsername';

describe('formatStoredPhone', () => {
  it('uses the international grouping', () => {
    expect(formatStoredPhone('+237699001221')).toBe('+237 6 99 00 12 21');
  });
});

describe('seedPhoneInputFromE164', () => {
  it('parses E.164 without a fallback region', () => {
    expect(seedPhoneInputFromE164('+237692168717', 'GA')).toEqual({
      countryIso: 'CM',
      nationalDigits: '692168717',
    });
  });

  it('treats national digits with the fallback country', () => {
    expect(seedPhoneInputFromE164('692168717', 'CM' as CountryCode)).toEqual({
      countryIso: 'CM',
      nationalDigits: '692168717',
    });
  });
});

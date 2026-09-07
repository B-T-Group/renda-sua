import type { CountryCode } from 'libphonenumber-js';
import { seedPhoneInputFromE164 } from './phoneLoginUsername';

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

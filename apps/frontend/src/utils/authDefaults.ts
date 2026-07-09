/**
 * Countries where email is the conventional primary login method.
 * All other countries (including CM, GA) default to phone/SMS.
 * Mirrors mobile `src/utils/authDefaults.ts`.
 */
const EMAIL_PREFERRED_COUNTRIES = new Set([
  'US',
  'CA',
  // EU / EEA
  'AT',
  'BE',
  'BG',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'HU',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SE',
  'SI',
  'SK',
  // Other Western markets
  'GB',
  'CH',
  'NO',
  'AU',
  'NZ',
]);

export type LoginIdentifierMode = 'phone' | 'email';
export type EmailSignInMode = 'otp' | 'password';

/** Best-effort browser locale → ISO country for login defaults. */
export function getBrowserDefaultCountryCode(): string {
  if (typeof navigator === 'undefined') return 'CM';
  const locale = navigator.language || (navigator.languages && navigator.languages[0]) || '';
  const parts = locale.replace('_', '-').split('-');
  const region = parts.length > 1 ? parts[parts.length - 1] : '';
  if (/^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  return 'CM';
}

export function getDefaultLoginMethod(countryCode: string): LoginIdentifierMode {
  return EMAIL_PREFERRED_COUNTRIES.has(countryCode.toUpperCase())
    ? 'email'
    : 'phone';
}

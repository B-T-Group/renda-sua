/**
 * Countries where email is the conventional primary login method.
 * All other countries (including CM, GA) default to phone/SMS.
 */
const EMAIL_PREFERRED_COUNTRIES = new Set([
  'US', 'CA',
  // EU / EEA
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  // Other Western markets
  'GB', 'CH', 'NO', 'AU', 'NZ',
]);

export type LoginIdentifierMode = 'phone' | 'email';

/**
 * Returns the appropriate default login method for a given ISO-3166-1 alpha-2
 * country code. Uses device locale (no permissions, no network).
 */
export function getDefaultLoginMethod(countryCode: string): LoginIdentifierMode {
  return EMAIL_PREFERRED_COUNTRIES.has(countryCode.toUpperCase()) ? 'email' : 'phone';
}

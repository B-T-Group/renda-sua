import { DateTime } from 'luxon';

export const DEFAULT_USER_TIMEZONE = 'Africa/Douala';

/** Maps address country code to default IANA timezone for the user's first address. */
export function timezoneFromAddressCountryCode(countryCode: string): string {
  const c = (countryCode ?? '').trim().toUpperCase();
  if (c === 'CM') return 'Africa/Douala';
  if (c === 'GA') return 'Africa/Libreville';
  if (c === 'CA') return 'America/Toronto';
  return DEFAULT_USER_TIMEZONE;
}

export function isValidIanaTimezone(zone: string): boolean {
  const z = zone?.trim();
  if (!z) return false;
  return DateTime.now().setZone(z).isValid;
}

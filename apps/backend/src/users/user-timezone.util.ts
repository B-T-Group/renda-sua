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

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Calendar Y/M/D from a Postgres/GraphQL `date` (YYYY-MM-DD) without using the
 * process local timezone (avoids off-by-one day when the server is not UTC).
 */
export function parseCalendarDatePartsFromPreferredDate(
  preferredDate: string | Date
): CalendarDateParts {
  if (typeof preferredDate === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(preferredDate.trim());
    if (m) {
      return {
        year: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
      };
    }
  }
  const d =
    typeof preferredDate === 'string' ? new Date(preferredDate) : preferredDate;
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

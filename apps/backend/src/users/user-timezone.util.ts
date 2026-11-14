import { DateTime } from 'luxon';
import { marketTimeZone } from '../common/market-timezones';

export const DEFAULT_USER_TIMEZONE = 'Africa/Douala';

/** Maps address country code to the market time zone, or Douala when the code is unknown. */
export function timezoneFromAddressCountryCode(countryCode: string): string {
  return marketTimeZone(countryCode) ?? DEFAULT_USER_TIMEZONE;
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

import { DateTime } from 'luxon';
import {
  DEFAULT_USER_TIMEZONE,
  isValidIanaTimezone,
  parseCalendarDatePartsFromPreferredDate,
  timezoneFromAddressCountryCode,
} from '../users/user-timezone.util';

export interface CleanupDeliveryWindow {
  preferred_date?: string | null;
  time_slot_end?: string | null;
}

export interface CleanupWindowOrder {
  pickup_by?: string | null;
  promised_fulfill_by?: string | null;
  delivery_time_window?: CleanupDeliveryWindow | null;
  client?: { user?: { timezone?: string | null } | null } | null;
  delivery_address?: { country?: string | null } | null;
  business_location?: {
    address?: { country?: string | null } | null;
  } | null;
}

/** Parse HH:MM or HH:MM:SS into hours/minutes. */
export function parseSlotTime(
  time: string
): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function createDateTimeInTimezone(
  preferredDate: string | Date,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  const { year, month, day } =
    parseCalendarDatePartsFromPreferredDate(preferredDate);
  const dt = DateTime.fromObject(
    { year, month, day, hour: hours, minute: minutes, second: 0 },
    { zone: timezone }
  );
  if (!dt.isValid) {
    throw new Error(`Invalid datetime: ${dt.invalidReason}`);
  }
  return dt.toUTC().toJSDate();
}

export function resolveCleanupTimezone(
  order: CleanupWindowOrder,
  configTimezone?: string | null
): string {
  const clientTz = order.client?.user?.timezone;
  if (clientTz && isValidIanaTimezone(clientTz)) return clientTz;
  if (configTimezone && isValidIanaTimezone(configTimezone)) {
    return configTimezone;
  }
  const country =
    order.business_location?.address?.country ||
    order.delivery_address?.country ||
    '';
  const fromCountry = timezoneFromAddressCountryCode(country);
  if (isValidIanaTimezone(fromCountry)) return fromCountry;
  return DEFAULT_USER_TIMEZONE;
}

function parseCleanupTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveSlotEndUtc(
  order: CleanupWindowOrder,
  timezone: string
): Date | null {
  const win = order.delivery_time_window;
  if (!win?.preferred_date || !win.time_slot_end) return null;
  const parsed = parseSlotTime(win.time_slot_end);
  if (!parsed) return null;
  try {
    return createDateTimeInTimezone(
      win.preferred_date,
      parsed.hours,
      parsed.minutes,
      timezone
    );
  } catch {
    return null;
  }
}

/**
 * Latest usable window/pickup instant in UTC. ASAP ready time (pickup_by)
 * must beat a stale placement-time promised_fulfill_by so late merchant
 * prep cannot expire the grace window before the order is actually ready.
 */
export function resolveWindowEndUtc(
  order: CleanupWindowOrder,
  timezone: string
): Date | null {
  const candidates = [
    parseCleanupTimestamp(order.promised_fulfill_by),
    parseCleanupTimestamp(order.pickup_by),
    resolveSlotEndUtc(order, timezone),
  ].filter((value): value is Date => value != null);
  if (!candidates.length) return null;
  return new Date(Math.max(...candidates.map((value) => value.getTime())));
}

/** True when windowEnd + graceHours is strictly before `now`. */
export function isWindowStale(
  windowEnd: Date,
  graceHours: number,
  now: Date = new Date()
): boolean {
  const staleAt = windowEnd.getTime() + graceHours * 60 * 60 * 1000;
  return staleAt < now.getTime();
}

export function isOrderWindowStale(
  order: CleanupWindowOrder,
  graceHours: number,
  timezone: string,
  now: Date = new Date()
): boolean {
  const end = resolveWindowEndUtc(order, timezone);
  if (!end) return false;
  return isWindowStale(end, graceHours, now);
}

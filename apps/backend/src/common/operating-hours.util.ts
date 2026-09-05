import { DateTime } from 'luxon';

export type DayName =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface OperatingHoursDay {
  closed: boolean;
  open?: string;
  close?: string;
}

export type OperatingHours = Partial<Record<DayName, OperatingHoursDay>>;

const DAY_NAMES_BY_INDEX: DayName[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const DAY_ABBREVIATIONS: Record<DayName, string> = {
  sunday: 'sun',
  monday: 'mon',
  tuesday: 'tue',
  wednesday: 'wed',
  thursday: 'thu',
  friday: 'fri',
  saturday: 'sat',
};

export const DEFAULT_OPERATING_HOURS: OperatingHours = {
  monday: { closed: false, open: '08:00', close: '20:00' },
  tuesday: { closed: false, open: '08:00', close: '20:00' },
  wednesday: { closed: false, open: '08:00', close: '20:00' },
  thursday: { closed: false, open: '08:00', close: '20:00' },
  friday: { closed: false, open: '08:00', close: '20:00' },
  saturday: { closed: true },
  sunday: { closed: true },
};

/** True when hours match the platform default Mon–Fri 08:00–20:00 schedule. */
export function isDefaultOperatingHours(raw: unknown): boolean {
  const normalized = normalizeOperatingHours(raw);
  if (!normalized) return true;
  for (const day of DAY_NAMES_BY_INDEX) {
    const a = normalized[day];
    const b = DEFAULT_OPERATING_HOURS[day];
    if (!a || !b) return false;
    if (Boolean(a.closed) !== Boolean(b.closed)) return false;
    if (a.closed) continue;
    if ((a.open ?? '') !== (b.open ?? '') || (a.close ?? '') !== (b.close ?? '')) {
      return false;
    }
  }
  return true;
}

/** Maps JS `Date.getDay()` (0 = Sunday) to a canonical day name. */
export function getDayNameForIndex(dayIndex: number): DayName {
  return DAY_NAMES_BY_INDEX[((dayIndex % 7) + 7) % 7];
}

/**
 * Parses `HH:mm` or `HH:mm:ss` (Postgres `time` columns round-trip through
 * Hasura as `HH:mm:ss`, e.g. delivery_time_slots.start_time) into minutes
 * since midnight. Seconds, if present, are truncated (not rounded).
 */
export function parseTimeToMinutes(
  value: string | undefined | null
): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Coerces any of the historical `operating_hours` JSON shapes (full or
 * 3-letter day keys; `open`/`close` or `start`/`end`; `closed`/`enabled`
 * flags; literal `"closed"` strings) into one canonical shape.
 */
export function normalizeOperatingHours(raw: unknown): OperatingHours | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const normalized: OperatingHours = {};
  for (const day of DAY_NAMES_BY_INDEX) {
    const entry = readRawDayEntry(source, day);
    if (entry) normalized[day] = entry;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

function readRawDayEntry(
  source: Record<string, unknown>,
  day: DayName
): OperatingHoursDay | null {
  const abbreviation = DAY_ABBREVIATIONS[day];
  const raw =
    source[day] ?? source[abbreviation] ?? source[abbreviation.toUpperCase()];
  if (!raw || typeof raw !== 'object') return null;

  const value = raw as Record<string, unknown>;
  const openRaw =
    typeof value.open === 'string'
      ? value.open
      : typeof value.start === 'string'
        ? value.start
        : undefined;
  const closeRaw =
    typeof value.close === 'string'
      ? value.close
      : typeof value.end === 'string'
        ? value.end
        : undefined;
  const explicitlyClosed =
    value.closed === true ||
    value.enabled === false ||
    openRaw === 'closed' ||
    closeRaw === 'closed';

  if (explicitlyClosed) {
    return { closed: true };
  }
  return {
    closed: false,
    open: openRaw && parseTimeToMinutes(openRaw) != null ? openRaw : undefined,
    close:
      closeRaw && parseTimeToMinutes(closeRaw) != null ? closeRaw : undefined,
  };
}

export function getDayHours(
  hours: OperatingHours | null,
  day: DayName
): OperatingHoursDay | null {
  return hours?.[day] ?? null;
}

/** Is the given minute-of-day within the day's open window? Supports overnight wrap (e.g. open 20:00, close 02:00). */
export function isTimeOfDayWithinHours(
  dayHours: OperatingHoursDay | null,
  minutesSinceMidnight: number
): boolean {
  if (!dayHours) return true;
  if (dayHours.closed) return false;
  const open = parseTimeToMinutes(dayHours.open);
  const close = parseTimeToMinutes(dayHours.close);
  if (open == null || close == null) return true;
  if (close < open) {
    return minutesSinceMidnight >= open || minutesSinceMidnight < close;
  }
  return minutesSinceMidnight >= open && minutesSinceMidnight < close;
}

/**
 * Is a [slotStart, slotEnd) time range fully contained within the day's open
 * window? Overnight wrap-around hours are not supported here since delivery
 * slots are always same-day ranges.
 */
export function isSlotFullyWithinHours(
  dayHours: OperatingHoursDay | null,
  slotStartTime: string,
  slotEndTime: string
): boolean {
  if (!dayHours) return true;
  if (dayHours.closed) return false;
  const open = parseTimeToMinutes(dayHours.open);
  const close = parseTimeToMinutes(dayHours.close);
  if (open == null || close == null) return true;
  if (close <= open) return false;
  const start = parseTimeToMinutes(slotStartTime);
  const end = parseTimeToMinutes(slotEndTime);
  if (start == null || end == null) return false;
  return start >= open && end <= close;
}

function jsWeekdayFromLuxon(local: DateTime): number {
  return local.weekday === 7 ? 0 : local.weekday;
}

function localMinutes(local: DateTime): number {
  return local.hour * 60 + local.minute;
}

/** Minutes until close in `timezone`. Null = hours unknown (treat as always open). 0 = closed now. */
export function minutesUntilClose(
  hours: unknown,
  now: Date,
  timezone: string
): number | null {
  const normalized = normalizeOperatingHours(hours);
  if (!normalized) return null;
  const local = DateTime.fromJSDate(now, { zone: timezone });
  if (!local.isValid) return null;
  const dayHours = getDayHours(
    normalized,
    getDayNameForIndex(jsWeekdayFromLuxon(local))
  );
  if (!dayHours || dayHours.closed) return 0;
  const openMins = parseTimeToMinutes(dayHours.open);
  const closeMins = parseTimeToMinutes(dayHours.close);
  if (openMins == null || closeMins == null) return null;
  const nowMins = localMinutes(local);
  if (!isTimeOfDayWithinHours(dayHours, nowMins)) return 0;
  if (closeMins < openMins) {
    if (nowMins >= openMins) return 24 * 60 - nowMins + closeMins;
    return closeMins - nowMins;
  }
  return Math.max(0, closeMins - nowMins);
}

/** Next local open instant, or null when hours are unknown. */
export function nextOpenAt(
  hours: unknown,
  now: Date,
  timezone: string
): Date | null {
  const normalized = normalizeOperatingHours(hours);
  if (!normalized) return null;
  const start = DateTime.fromJSDate(now, { zone: timezone });
  if (!start.isValid) return null;
  for (let offset = 0; offset < 8; offset += 1) {
    const day = start.plus({ days: offset });
    const dayHours = getDayHours(
      normalized,
      getDayNameForIndex(jsWeekdayFromLuxon(day))
    );
    if (!dayHours || dayHours.closed) continue;
    const openMins = parseTimeToMinutes(dayHours.open);
    if (openMins == null) continue;
    const open = day.startOf('day').plus({ minutes: openMins });
    if (offset === 0 && open <= start) continue;
    return open.toUTC().toJSDate();
  }
  return null;
}

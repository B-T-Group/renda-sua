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

/** Maps JS `Date.getDay()` (0 = Sunday) to a canonical day name. */
export function getDayNameForIndex(dayIndex: number): DayName {
  return DAY_NAMES_BY_INDEX[((dayIndex % 7) + 7) % 7];
}

export function parseTimeToMinutes(
  value: string | undefined | null
): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
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

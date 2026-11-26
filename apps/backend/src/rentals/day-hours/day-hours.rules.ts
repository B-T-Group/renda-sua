/**
 * Server rules for the rental day-and-hours picker (rentals_day_hours_picker_enabled).
 *
 * Times are floating listing wall-clock encoded as `YYYY-MM-DDTHH:mm:00Z`, so every
 * date and hour here is read with UTC getters (the same convention as the rest of
 * the rentals service).
 */

export const DAY_HOURS_FLAG_KEY = 'rentals_day_hours_picker_enabled';

/** Renters must start at least 2 hours from now, in the listing's local time. */
export const RENTAL_LEAD_TIME_MS = 2 * 60 * 60 * 1000;
/** Time the renter may spend on the sheet before a boundary slot is rejected. */
export const RENTAL_LEAD_TIME_GRACE_MS = 10 * 60 * 1000;

export const DAY_HOURS_CODES = {
  MODE_DAILY_OFF: 'RENTAL_DAILY_NOT_OFFERED',
  MODE_HOURLY_OFF: 'RENTAL_HOURLY_NOT_OFFERED',
  NOT_IN_A_ROW: 'RENTAL_DAYS_NOT_IN_A_ROW',
  ONE_BLOCK_PER_DAY: 'RENTAL_ONE_BLOCK_PER_DAY',
  BLOCK_BELOW_MIN: 'RENTAL_BLOCK_BELOW_MIN_HOURS',
  BLOCK_ABOVE_MAX: 'RENTAL_BLOCK_ABOVE_MAX_HOURS',
  LEAD_TIME: 'RENTAL_LEAD_TIME',
  LISTING_NEEDS_A_MODE: 'RENTAL_LISTING_NEEDS_A_MODE',
  LISTING_MODE_PRICE: 'RENTAL_LISTING_MODE_PRICE',
} as const;

export type DayHoursCode = (typeof DAY_HOURS_CODES)[keyof typeof DAY_HOURS_CODES];

export interface DayHoursViolation {
  code: DayHoursCode;
  message: string;
}

export interface DayHoursWindow {
  start: Date;
  end: Date;
  billing: 'hourly' | 'all_day';
  calendarDate?: string;
}

export interface DayHoursWeeklyRow {
  weekday: number;
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
}

export interface ListingModes {
  offers_hourly?: boolean | null;
  offers_daily?: boolean | null;
}

/** Missing columns (old rows, old queries) read as on. */
export function listingOffersHourly(listing: ListingModes | null | undefined): boolean {
  return listing?.offers_hourly !== false;
}

export function listingOffersDaily(listing: ListingModes | null | undefined): boolean {
  return listing?.offers_daily !== false;
}

/** A window must use a way of renting the listing offers. Always applied. */
export function modeViolation(
  windows: DayHoursWindow[],
  listing: ListingModes | null | undefined
): DayHoursViolation | null {
  if (!listingOffersDaily(listing) && windows.some((w) => w.billing === 'all_day')) {
    return {
      code: DAY_HOURS_CODES.MODE_DAILY_OFF,
      message: 'This item rents by the hour only. Pick hours instead of a full day.',
    };
  }
  if (!listingOffersHourly(listing) && windows.some((w) => w.billing !== 'all_day')) {
    return {
      code: DAY_HOURS_CODES.MODE_HOURLY_OFF,
      message: 'This item rents by the day only. Pick full days.',
    };
  }
  return null;
}

function hoursOf(w: DayHoursWindow): number {
  const ms = w.end.getTime() - w.start.getTime();
  return Math.max(1, Math.ceil(ms / 3600000));
}

/** Min and max hours apply to each hour block. Full days are exempt. */
export function blockHoursViolation(
  windows: DayHoursWindow[],
  minHours: number | null | undefined,
  maxHours: number | null | undefined
): DayHoursViolation | null {
  const min = Math.max(1, Number(minHours) || 1);
  const max = maxHours == null ? null : Number(maxHours);
  for (const w of windows) {
    if (w.billing === 'all_day') continue;
    const h = hoursOf(w);
    if (h < min) {
      return {
        code: DAY_HOURS_CODES.BLOCK_BELOW_MIN,
        message: `Each hour block must be at least ${min} h.`,
      };
    }
    if (max != null && Number.isFinite(max) && h > max) {
      return {
        code: DAY_HOURS_CODES.BLOCK_ABOVE_MAX,
        message: `Each hour block can be at most ${max} h.`,
      };
    }
  }
  return null;
}

function dateKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dateKeyUtc(d);
}

/** Calendar dates a window touches (end is exclusive). */
export function windowDateKeys(w: DayHoursWindow): string[] {
  if (w.billing === 'all_day' && w.calendarDate) return [w.calendarDate];
  const first = dateKeyUtc(w.start);
  const last = dateKeyUtc(new Date(w.end.getTime() - 1));
  const out = [first];
  let cursor = first;
  while (cursor < last && out.length < 400) {
    cursor = addDaysKey(cursor, 1);
    out.push(cursor);
  }
  return out;
}

function isOpenWeekday(key: string, weekly: DayHoursWeeklyRow[]): boolean {
  const weekday = new Date(`${key}T00:00:00.000Z`).getUTCDay();
  const row = weekly.find((r) => Number(r.weekday) === weekday);
  return Boolean(row?.is_available && row.start_time && row.end_time);
}

/**
 * One booking has one pickup and one return, so the picked days must be in a row.
 * A weekday the listing is closed may sit between two picked days (Fri, Mon with
 * Sunday closed); an open day may not. One block per day.
 */
export function daysInARowViolation(
  windows: DayHoursWindow[],
  weekly: DayHoursWeeklyRow[]
): DayHoursViolation | null {
  const seen = new Set<string>();
  for (const w of windows) {
    for (const key of windowDateKeys(w)) {
      if (seen.has(key)) {
        return {
          code: DAY_HOURS_CODES.ONE_BLOCK_PER_DAY,
          message: 'Pick one full day or one hour block per day.',
        };
      }
      seen.add(key);
    }
  }
  const keys = [...seen].sort();
  if (keys.length < 2) return null;
  let cursor = keys[0];
  const last = keys[keys.length - 1];
  let guard = 0;
  while (cursor < last && guard < 400) {
    cursor = addDaysKey(cursor, 1);
    guard += 1;
    if (seen.has(cursor)) continue;
    if (isOpenWeekday(cursor, weekly)) {
      return { code: DAY_HOURS_CODES.NOT_IN_A_ROW, message: 'Pick days in a row.' };
    }
  }
  return null;
}

/** Wall-clock "now" in `timeZone`, encoded the same way as request times. */
export function wallClockNowMs(nowMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(nowMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  } catch {
    return nowMs;
  }
}

/** Every window starts at least 2 hours from now (listing local time), less a small grace. */
export function leadTimeViolation(
  windows: DayHoursWindow[],
  nowMs: number,
  timeZone: string
): DayHoursViolation | null {
  const earliest = wallClockNowMs(nowMs, timeZone) + RENTAL_LEAD_TIME_MS - RENTAL_LEAD_TIME_GRACE_MS;
  for (const w of windows) {
    if (w.start.getTime() < earliest) {
      return {
        code: DAY_HOURS_CODES.LEAD_TIME,
        message: 'Start at least 2 hours from now.',
      };
    }
  }
  return null;
}

export interface DayHoursListing extends ListingModes {
  weekly_availability?: DayHoursWeeklyRow[] | null;
}

/** All picker rules in order. Run only when the flag is on for the listing's country. */
export function dayHoursPickerViolation(input: {
  windows: DayHoursWindow[];
  listing: DayHoursListing;
  minHours: number | null | undefined;
  maxHours: number | null | undefined;
  nowMs: number;
  timeZone: string;
}): DayHoursViolation | null {
  return (
    leadTimeViolation(input.windows, input.nowMs, input.timeZone) ??
    daysInARowViolation(input.windows, input.listing.weekly_availability ?? []) ??
    blockHoursViolation(input.windows, input.minHours, input.maxHours)
  );
}

/** Listing switches: at least one way to rent, and a price above 0 for each one on. */
export function listingModesViolation(input: {
  offersHourly: boolean;
  offersDaily: boolean;
  hourPrice: number;
  dayPrice: number;
}): DayHoursViolation | null {
  if (!input.offersHourly && !input.offersDaily) {
    return {
      code: DAY_HOURS_CODES.LISTING_NEEDS_A_MODE,
      message: 'Turn on Rent by the day, Rent by the hour, or both.',
    };
  }
  if (input.offersDaily && !(input.dayPrice > 0)) {
    return { code: DAY_HOURS_CODES.LISTING_MODE_PRICE, message: 'Set a price per day.' };
  }
  if (input.offersHourly && !(input.hourPrice > 0)) {
    return { code: DAY_HOURS_CODES.LISTING_MODE_PRICE, message: 'Set a price per hour.' };
  }
  return null;
}

/**
 * Hour rate behind the default card deposit (8 × this rate), the one rule shared by
 * server create, web edit and mobile add/edit:
 * - the hourly price, when the listing rents by the hour and has one;
 * - otherwise the day price ÷ 12 (day prices were backfilled as 12 × hourly), so a
 *   day-only listing defaults to two thirds of its day price.
 */
export function depositHourRate(input: {
  hourPrice: number;
  dayPrice: number;
  offersHourly?: boolean | null;
}): number {
  const hour = Number(input.hourPrice);
  if (input.offersHourly !== false && hour > 0) return hour;
  const day = Number(input.dayPrice);
  return day > 0 ? day / 12 : 0;
}

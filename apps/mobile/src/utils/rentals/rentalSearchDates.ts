import { formatRentalDateRange, formatRentalPeriod, formatRentalShortMonth, type PeriodWindow } from './rentalRequestFormat';

export const MAX_RENTAL_SEARCH_DAYS = 30;

/**
 * `endDate` is exclusive. `startTime` applies to `startDate` and `endTime` to the last day
 * (`endDate` minus one), both as HH:mm listing wall-clock; `24:00` ends that day. No times
 * means whole days.
 */
export interface RentalDateRange {
  startDate: string;
  endDate: string;
  dayCount: number;
  startTime?: string;
  endTime?: string;
}

export interface RentalRangeTimes {
  startTime?: string;
  endTime?: string;
}

const CLOCK = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

export type RentalDateRangeResult =
  | { status: 'ok'; range: RentalDateRange }
  | { status: 'too_long'; startDate: string; endDate: string; dayCount: number }
  | { status: 'invalid' };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function utcDayMs(value: string): number | null {
  const match = DATE.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** End date is exclusive. A span longer than 30 days is reported, not dropped. */
export function describeRentalDateRange(start: Date, end: Date): RentalDateRangeResult {
  const startDate = formatIsoDate(start);
  const endDate = formatIsoDate(end);
  const startMs = utcDayMs(startDate);
  const endMs = utcDayMs(endDate);
  if (startMs == null || endMs == null || endMs <= startMs) return { status: 'invalid' };
  const dayCount = Math.round((endMs - startMs) / 86_400_000);
  if (dayCount < 1) return { status: 'invalid' };
  if (dayCount > MAX_RENTAL_SEARCH_DAYS) {
    return { status: 'too_long', startDate, endDate, dayCount };
  }
  return { status: 'ok', range: { startDate, endDate, dayCount } };
}

export function rentalDateRange(start: Date, end: Date): RentalDateRange | null {
  const described = describeRentalDateRange(start, end);
  return described.status === 'ok' ? described.range : null;
}

/** Dates from a search link. The end day is exclusive and the stay is at most 30 days. */
export function rangeFromSearchParams(
  startDate?: string,
  endDate?: string,
  startTime?: string,
  endTime?: string
): RentalDateRange | null {
  if (!startDate || !endDate) return null;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const dayCount = Math.round((end - start) / 86_400_000);
  if (dayCount < 1 || dayCount > MAX_RENTAL_SEARCH_DAYS) return null;
  const times = validTimes(startTime, endTime);
  if (!times) return null;
  if (dayCount === 1 && (times.startTime ?? '00:00') >= (times.endTime ?? '24:00')) return null;
  return { startDate, endDate, dayCount, ...times };
}

/** Only well-formed clock times survive. A one-day window must end after it starts. */
function validTimes(startTime?: string, endTime?: string): RentalRangeTimes | null {
  if ((startTime && !CLOCK.test(startTime)) || (endTime && !CLOCK.test(endTime))) return null;
  if (startTime === '24:00') return null;
  return { ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) };
}

/** Saturday and Sunday. On Sunday the range is the remaining day. */
export function weekendRange(now = new Date()): RentalDateRange {
  const today = startOfLocalDay(now);
  const day = today.getDay();
  if (day === 0) return rentalDateRange(today, addLocalDays(today, 1))!;
  if (day === 6) return rentalDateRange(today, addLocalDays(today, 2))!;
  const saturday = addLocalDays(today, 6 - day);
  return rentalDateRange(saturday, addLocalDays(saturday, 2))!;
}

export function shiftRange(range: RentalDateRange, days: number): RentalDateRange | null {
  const startMs = utcDayMs(range.startDate);
  const endMs = utcDayMs(range.endDate);
  if (startMs == null || endMs == null) return null;
  const start = new Date(startMs + days * 86_400_000);
  const end = new Date(endMs + days * 86_400_000);
  const shifted = rentalDateRange(
    new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );
  return shifted ? { ...shifted, ...timesOf(range) } : null;
}

export function timesOf(range: RentalRangeTimes): RentalRangeTimes {
  return {
    ...(range.startTime ? { startTime: range.startTime } : {}),
    ...(range.endTime ? { endTime: range.endTime } : {}),
  };
}

export function rangeFromNextStart(nextDate: string, dayCount: number, times: RentalRangeTimes = {}): RentalDateRange | null {
  const startMs = utcDayMs(nextDate);
  if (startMs == null || dayCount < 1) return null;
  const start = new Date(startMs);
  const local = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const range = rentalDateRange(local, addLocalDays(local, dayCount));
  return range ? { ...range, ...timesOf(times) } : null;
}

export function nearbyRanges(range: RentalDateRange, now = new Date()): RentalDateRange[] {
  const weekend = weekendRange(now);
  const rows = [shiftRange(range, 4), shiftRange(range, 8), weekend].filter(
    (row): row is RentalDateRange => row != null
  );
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.startDate}/${row.endDate}`;
    if (key === `${range.startDate}/${range.endDate}` || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type StayListener = (range: RentalDateRange) => void;
const stayListeners = new Set<StayListener>();

/** The results list listens so an edit on the request sheet updates every card. */
export function subscribeRentalSearchStay(listener: StayListener): () => void {
  stayListeners.add(listener);
  return () => {
    stayListeners.delete(listener);
  };
}

export function publishRentalSearchStay(range: RentalDateRange): void {
  stayListeners.forEach((listener) => listener(range));
}

export function formatRangeDates(range: RentalDateRange, locale: string): string {
  const startMs = utcDayMs(range.startDate);
  const endMs = utcDayMs(range.endDate);
  if (startMs == null || endMs == null) return `${range.startDate} – ${range.endDate}`;
  const start = new Date(startMs);
  const end = new Date(endMs);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${formatRentalShortMonth(range.endDate, locale)}`;
  }
  return `${start.getUTCDate()} ${formatRentalShortMonth(range.startDate, locale)} – ${end.getUTCDate()} ${formatRentalShortMonth(range.endDate, locale)}`;
}

const MARKET_TIME_ZONES: Record<string, string> = {
  CM: 'Africa/Douala',
  GA: 'Africa/Libreville',
  TG: 'Africa/Lome',
};

/** IANA zone for a market, so "today" follows the market clock rather than the phone. */
export function marketTimeZone(countryCode?: string | null): string | undefined {
  if (!countryCode) return undefined;
  return MARKET_TIME_ZONES[countryCode.toUpperCase()];
}

export function eachDateKey(range: RentalDateRange): string[] {
  const keys: string[] = [];
  const start = utcDayMs(range.startDate);
  if (start == null) return keys;
  for (let i = 0; i < range.dayCount; i += 1) {
    keys.push(new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  }
  return keys;
}

/** The days a booking would charge, labeled with `formatRentalPeriod`. */
export function formatSearchStay(
  range: RentalDateRange,
  locale: string,
  dayCountLabel: (count: number) => string
): string {
  return formatRentalPeriod(bookedStayWindows(range), locale, dayCountLabel);
}

/** Same booked days, without the count (`22–24 Nov`). */
export function formatSearchStayRange(range: RentalDateRange, locale: string): string {
  return formatRentalDateRange(bookedStayWindows(range), locale);
}

function bookedStayWindows(range: RentalDateRange): PeriodWindow[] {
  return eachDateKey(range).map((calendar_date) => ({
    billing: 'all_day',
    calendar_date,
    start_at: '',
    end_at: '',
  }));
}

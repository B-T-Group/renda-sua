export const MAX_RENTAL_SEARCH_DAYS = 30;

export interface RentalDateRange {
  startDate: string;
  endDate: string;
  dayCount: number;
}

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

export function parseIsoLocal(iso: string): Date | null {
  const ms = utcDayMs(iso);
  if (ms == null) return null;
  const utc = new Date(ms);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
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

export function todayRange(now = new Date()): RentalDateRange {
  const start = startOfLocalDay(now);
  return rentalDateRange(start, addLocalDays(start, 1))!;
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

export function weekRange(now = new Date()): RentalDateRange {
  const start = startOfLocalDay(now);
  return rentalDateRange(start, addLocalDays(start, 7))!;
}

export function shiftRange(range: RentalDateRange, days: number): RentalDateRange | null {
  const startMs = utcDayMs(range.startDate);
  const endMs = utcDayMs(range.endDate);
  if (startMs == null || endMs == null) return null;
  const start = new Date(startMs + days * 86_400_000);
  const end = new Date(endMs + days * 86_400_000);
  return rentalDateRange(
    new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    new Date(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  );
}

export function rangeFromNextStart(nextDate: string, dayCount: number): RentalDateRange | null {
  const startMs = utcDayMs(nextDate);
  if (startMs == null || dayCount < 1) return null;
  const start = new Date(startMs);
  const local = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return rentalDateRange(local, addLocalDays(local, dayCount));
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

/** "14–16 Nov · 2 days" — `daysLabel` is already translated. */
export function formatSheetDateLine(range: RentalDateRange, locale: string, daysLabel: string): string {
  return `${formatRangeDates(range, locale)} · ${daysLabel}`;
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
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month.format(end)}`;
  }
  return `${start.getUTCDate()} ${month.format(start)} – ${end.getUTCDate()} ${month.format(end)}`;
}

export function formatSingleDate(iso: string, locale: string): string {
  const ms = utcDayMs(iso);
  if (ms == null) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(ms));
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

/** Calendar year/month/day in a timezone. Month is 1-based. */
export function calendarDateInTimeZone(
  now: Date,
  timeZone?: string
): { year: number; month: number; day: number; iso: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    if (!year || !month || !day) throw new Error('incomplete');
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { year, month, day, iso };
  } catch {
    const iso = formatIsoDate(now);
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), iso };
  }
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

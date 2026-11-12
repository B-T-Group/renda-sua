/**
 * Listing wall clock is stored as UTC components (Africa/Douala written with a Z suffix).
 * Format those components directly. Passing timeZone Africa/Douala would add an hour,
 * and the browser zone would move the day for anyone outside Cameroon.
 */
export const LISTING_TIME_ZONE = 'Africa/Douala';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EN_DASH = '\u2013';

export type PeriodWindow = {
  billing?: string;
  calendar_date?: string;
  start_at: string;
  end_at: string;
};

type DayCountLabel = (count: number) => string;

function utcDate(iso: string): Date | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function capitalizeFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function monthLabel(isoDate: string, locale: string): string {
  const date = utcDate(isoDate);
  if (!date) return '';
  const french = locale.toLowerCase().startsWith('fr');
  const raw = new Intl.DateTimeFormat(french ? 'fr' : 'en', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
  return french ? raw : capitalizeFirst(raw.replace(/\./g, ''));
}

function dayNum(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function sameMonth(left: string, right: string): boolean {
  return left.slice(0, 7) === right.slice(0, 7);
}

function clock(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  return match ? `${match[1]}:${match[2]}` : '';
}

function addUtcDays(iso: string, offset: number): string {
  const date = utcDate(iso);
  if (!date) return iso;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** `12 Nov` or `12–14 Nov`. A cross-month stay reads `30 Nov – 2 Dec`. */
export function formatRentalDateRange(windows: PeriodWindow[], locale: string): string {
  const days = calendarDays(windows);
  if (!days.length) return '';
  return rangeLabel(days[0], days[days.length - 1], locale);
}

function calendarDays(windows: PeriodWindow[]): string[] {
  return windows
    .map((row) => row.calendar_date)
    .filter((day): day is string => Boolean(day && ISO_DATE.test(day)))
    .sort();
}

function rangeLabel(start: string, end: string, locale: string): string {
  const endMonth = monthLabel(end, locale);
  if (start === end) return `${dayNum(start)} ${endMonth}`;
  if (sameMonth(start, end)) return `${dayNum(start)}${EN_DASH}${dayNum(end)} ${endMonth}`;
  const startMonth = monthLabel(start, locale);
  return `${dayNum(start)} ${startMonth} ${EN_DASH} ${dayNum(end)} ${endMonth}`;
}

function hourlyLine(row: PeriodWindow, locale: string): string {
  const day = row.start_at.slice(0, 10);
  const month = monthLabel(day, locale);
  return `${dayNum(day)} ${month} · ${clock(row.start_at)}${EN_DASH}${clock(row.end_at)}`;
}

/** Booked calendar days. A same-clock end the next morning is the return, not another day. */
function bookedDayKeys(row: PeriodWindow): string[] | null {
  if (row.billing === 'all_day' && row.calendar_date && ISO_DATE.test(row.calendar_date)) {
    return [row.calendar_date];
  }
  return sameClockSpan(row);
}

function sameClockSpan(row: PeriodWindow): string[] | null {
  const start = row.start_at.slice(0, 10);
  const end = row.end_at.slice(0, 10);
  const startClock = clock(row.start_at);
  const endClock = clock(row.end_at);
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || !startClock) return null;
  if (startClock !== endClock || end <= start) return null;
  return daysUntil(start, end);
}

function daysUntil(start: string, end: string): string[] | null {
  const keys: string[] = [];
  let cursor = start;
  while (cursor < end && keys.length < 366) {
    keys.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return keys.length ? keys : null;
}

function bookedCalendarDates(windows: PeriodWindow[]): string[] | null {
  const days: string[] = [];
  for (const row of windows) {
    const keys = bookedDayKeys(row);
    if (!keys) return null;
    days.push(...keys);
  }
  const unique = [...new Set(days)].sort();
  return unique.length ? unique : null;
}

export function formatRentalPeriod(
  windows: PeriodWindow[],
  locale: string,
  dayCountLabel: DayCountLabel
): string {
  if (!windows.length) return '—';
  const booked = bookedCalendarDates(windows);
  if (booked) return dailyPeriod(booked, locale, dayCountLabel);
  return windows.map((row) => hourlyLine(row, locale)).join(', ');
}

function dailyPeriod(booked: string[], locale: string, dayCountLabel: DayCountLabel): string {
  const asWindows = booked.map((calendar_date) => ({
    calendar_date,
    start_at: '',
    end_at: '',
  }));
  return `${formatRentalDateRange(asWindows, locale)} · ${dayCountLabel(booked.length)}`;
}

function isContiguous(days: string[]): boolean {
  if (days.length <= 1) return true;
  return days.every((day, index) => index === 0 || day === addUtcDays(days[index - 1], 1));
}

/** One stay: a single window, or contiguous daily days that read as one range. */
export function isSingleRequestedPeriod(windows: PeriodWindow[]): boolean {
  if (windows.length <= 1) return true;
  const booked = bookedCalendarDates(windows);
  return Boolean(booked && isContiguous(booked));
}

/**
 * One line when the request is a single period.
 * Numbered lines only when the request has several separate periods.
 */
export function clientRequestPeriodLines(
  windows: PeriodWindow[],
  locale: string,
  dayCountLabel: DayCountLabel
): string[] {
  if (!windows.length) return [];
  if (isSingleRequestedPeriod(windows)) {
    return [formatRentalPeriod(windows, locale, dayCountLabel)];
  }
  return windows.map((window, index) => numberedPeriod(window, index, locale, dayCountLabel));
}

function numberedPeriod(
  window: PeriodWindow,
  index: number,
  locale: string,
  dayCountLabel: DayCountLabel
): string {
  return `${index + 1}. ${formatRentalPeriod([window], locale, dayCountLabel)}`;
}

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

const EN_SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const FR_SHORT_MONTH = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const;

/** `Nov` / `nov.` House short months. FR uses typographic abbreviations (period only when truncated). */
export function formatRentalShortMonth(iso: string, locale: string): string {
  const date = utcDate(iso.slice(0, 10));
  if (!date) return '';
  const months = locale.toLowerCase().startsWith('fr') ? FR_SHORT_MONTH : EN_SHORT_MONTH;
  return months[date.getUTCMonth()];
}

function monthLabel(isoDate: string, locale: string): string {
  return formatRentalShortMonth(isoDate, locale);
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

/** Douala wall-clock components stored with a Z suffix: `12 Nov · 21:00`. */
export function formatListingDue(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  const time = clock(iso);
  if (!ISO_DATE.test(day) || !time) return iso;
  return `${dayNum(day)}\u00A0${monthLabel(day, locale)}\u00A0·\u00A0${time}`;
}

function addUtcDays(iso: string, offset: number): string {
  const date = utcDate(iso);
  if (!date) return iso;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** `17 Nov` / `17 nov.` Day then month, never the locale's month-day order. */
export function formatRentalDay(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  if (!ISO_DATE.test(day)) return iso;
  return `${dayNum(day)} ${monthLabel(day, locale)}`;
}

/** Exclusive-end return morning: `Return 29 Nov` / `Retour le 29\u00A0nov.` */
export function formatReturnDay(iso: string, locale: string): string {
  const day = iso.slice(0, 10);
  if (!ISO_DATE.test(day)) return iso;
  const label = `${dayNum(day)}\u00A0${monthLabel(day, locale)}`;
  return locale.toLowerCase().startsWith('fr') ? `Retour le ${label}` : `Return ${label}`;
}

/** Calendar day after the last booked day (the exclusive end / return morning). */
export function returnDateAfterBookedDays(booked: string[]): string | undefined {
  if (!booked.length) return undefined;
  return addUtcDays(booked[booked.length - 1], 1);
}

export function appendReturnDay(line: string, returnIso: string | undefined, locale: string): string {
  if (!returnIso || !line || line === '—' || line === '\u2014') return line;
  return `${line} · ${formatReturnDay(returnIso, locale)}`;
}

function periodLineWithReturn(windows: PeriodWindow[], locale: string, line: string): string {
  const booked = bookedCalendarDates(windows);
  return appendReturnDay(line, booked ? returnDateAfterBookedDays(booked) : undefined, locale);
}

/** Daily request/booking summary: booked days, count, and the return morning. Hourly is unchanged. */
export function formatRequestedPeriod(
  windows: PeriodWindow[],
  locale: string,
  dayCountLabel: DayCountLabel
): string {
  return periodLineWithReturn(windows, locale, formatRentalPeriod(windows, locale, dayCountLabel));
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
  const start = clock(row.start_at);
  const end = clock(row.end_at);
  const times = start && end && start !== end ? `${start}${EN_DASH}${end}` : start || end;
  return `${dayNum(day)} ${month} · ${times}`;
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

/** Booked days of an exclusive search range, labeled like a booking (`22–24 Nov · 3 days`). */
export function formatExclusiveStay(
  start: string,
  end: string,
  locale: string,
  dayCountLabel: DayCountLabel
): string {
  return formatRentalPeriod(exclusiveStayWindows(start, end), locale, dayCountLabel);
}

/** Same booked days, without the count (`22–24 Nov`). */
export function formatExclusiveStayRange(start: string, end: string, locale: string): string {
  return formatRentalDateRange(exclusiveStayWindows(start, end), locale);
}

function exclusiveStayWindows(start: string, end: string): PeriodWindow[] {
  return (daysUntil(start, end) ?? []).map((calendar_date) => ({
    billing: 'all_day',
    calendar_date,
    start_at: '',
    end_at: '',
  }));
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
    return [formatRequestedPeriod(windows, locale, dayCountLabel)];
  }
  return windows.map((window, index) => numberedPeriod(window, index, locale, dayCountLabel));
}

function numberedPeriod(
  window: PeriodWindow,
  index: number,
  locale: string,
  dayCountLabel: DayCountLabel
): string {
  return periodLineWithReturn([window], locale, `${index + 1}. ${formatRentalPeriod([window], locale, dayCountLabel)}`);
}

/** Selection windows when the booking has them; otherwise the booked start–end span. */
export function bookingPeriodWindows(
  windows: PeriodWindow[],
  span?: { start_at?: string | null; end_at?: string | null } | null
): PeriodWindow[] {
  if (windows.length) return windows;
  if (!span?.start_at || !span.end_at) return [];
  return [{ start_at: span.start_at, end_at: span.end_at }];
}

export function bookingRequestedPeriodLines(
  windows: PeriodWindow[],
  span: { start_at?: string | null; end_at?: string | null } | null | undefined,
  locale: string,
  dayCountLabel: DayCountLabel
): string[] {
  return clientRequestPeriodLines(bookingPeriodWindows(windows, span), locale, dayCountLabel);
}

/** Booking detail: keep a cross-day clock span when present, and append the return morning for a daily stay. */
export function bookingDetailPeriodLines(
  windows: PeriodWindow[],
  span: { start_at?: string | null; end_at?: string | null } | null | undefined,
  locale: string,
  dayCountLabel: DayCountLabel,
  bookedSpan?: string | null
): string[] {
  if (bookedSpan) {
    const resolved = bookingPeriodWindows(windows, span);
    const booked = bookedCalendarDates(resolved);
    const ret = booked && isContiguous(booked) ? returnDateAfterBookedDays(booked) : undefined;
    return [appendReturnDay(bookedSpan, ret, locale)];
  }
  return bookingRequestedPeriodLines(windows, span, locale, dayCountLabel);
}

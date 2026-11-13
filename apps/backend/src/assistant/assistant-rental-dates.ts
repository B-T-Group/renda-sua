import { DateTime } from 'luxon';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_DAYS = 30;
const YEARLESS_HORIZON_DAYS = 60;
/** A return in the first minutes after local midnight does not occupy that day. */
export const NEXT_MORNING_GRACE_MINUTES = 30;

export type RentalDateIssue = 'past' | 'end_before_start' | 'too_long' | 'unparseable';

export type ResolvedRentalRange =
  | { status: 'ok'; startDate: string; endDate: string; dayCount: number }
  | {
      status: 'invalid_dates';
      dateIssue: RentalDateIssue;
      suggestion?: { startDate: string; endDate: string; dayCount: number };
    };

export function marketCalendarDate(now: Date, zone: string): string {
  return DateTime.fromJSDate(now, { zone: 'utc' }).setZone(zone).toFormat('yyyy-MM-dd');
}

export function formatMarketNow(now: Date, zone: string): string {
  const local = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(zone);
  return `${local.toFormat('cccc d LLL yyyy')}, ${local.toFormat('HH:mm')} in ${zone}`;
}

export function addCalendarDays(iso: string, days: number): string {
  return DateTime.fromISO(iso, { zone: 'utc' }).plus({ days }).toFormat('yyyy-MM-dd');
}

export function exclusiveDayCount(start: string, end: string): number | null {
  if (!isRealDate(start) || !isRealDate(end)) return null;
  const days = DateTime.fromISO(end).diff(DateTime.fromISO(start), 'days').days;
  return Number.isFinite(days) ? Math.round(days) : null;
}

export function validateExclusiveRange(start: string, end: string, today: string): ResolvedRentalRange {
  if (!isRealDate(start) || !isRealDate(end)) {
    return { status: 'invalid_dates', dateIssue: 'unparseable' };
  }
  if (end <= start) return endBeforeStart(start, end, today);
  if (start < today) return { status: 'invalid_dates', dateIssue: 'past' };
  const days = exclusiveDayCount(start, end) ?? 0;
  if (days > MAX_DAYS) return tooLong(start);
  return { status: 'ok', startDate: start, endDate: end, dayCount: days };
}

/** Next occurrence of a month/day. More than 60 days out counts as a past date. */
export function resolveMonthDay(month: number, day: number, today: string): { date: string; past: boolean } {
  const year = Number(today.slice(0, 4));
  let candidate = calendarDate(year, month, day);
  if (!candidate) return { date: today, past: true };
  if (candidate < today) candidate = calendarDate(year + 1, month, day) ?? candidate;
  const ahead = exclusiveDayCount(today, candidate) ?? 0;
  return { date: candidate, past: ahead > YEARLESS_HORIZON_DAYS };
}

export function relativeDayRange(
  kind: 'today' | 'tomorrow' | 'weekend',
  now: Date,
  zone: string
): { startDate: string; endDate: string; dayCount: number } {
  const today = marketCalendarDate(now, zone);
  if (kind === 'today') return rangeFrom(today, 1);
  if (kind === 'tomorrow') return rangeFrom(addCalendarDays(today, 1), 1);
  return weekendRange(now, zone);
}

/**
 * True when the booking overlaps the market day outside the 30-minute return grace.
 * A booking ending at 00:30 local does not block that calendar day.
 */
export function blocksMarketRentalDay(input: {
  startIso: string;
  endIso: string;
  day: string;
  zone: string;
}): boolean {
  const dayStart = DateTime.fromISO(input.day, { zone: input.zone }).startOf('day');
  const occupiedStart = dayStart.plus({ minutes: NEXT_MORNING_GRACE_MINUTES });
  const dayEnd = dayStart.plus({ days: 1 });
  const start = DateTime.fromISO(input.startIso, { setZone: true }).setZone(input.zone);
  const end = DateTime.fromISO(input.endIso, { setZone: true }).setZone(input.zone);
  const overlapStart = start > occupiedStart ? start : occupiedStart;
  const overlapEnd = end < dayEnd ? end : dayEnd;
  return overlapEnd > overlapStart;
}

function endBeforeStart(start: string, end: string, today: string): ResolvedRentalRange {
  const swapped = end < start ? validateExclusiveRange(end, start, today) : null;
  const suggestion = swapped?.status === 'ok' ? swapped : undefined;
  return { status: 'invalid_dates', dateIssue: 'end_before_start', suggestion };
}

function tooLong(start: string): ResolvedRentalRange {
  return {
    status: 'invalid_dates',
    dateIssue: 'too_long',
    suggestion: { startDate: start, endDate: addCalendarDays(start, MAX_DAYS), dayCount: MAX_DAYS },
  };
}

function rangeFrom(start: string, days: number) {
  return { startDate: start, endDate: addCalendarDays(start, days), dayCount: days };
}

function weekendRange(now: Date, zone: string) {
  const local = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(zone).startOf('day');
  const weekday = local.weekday;
  if (weekday === 7) return rangeFrom(local.toFormat('yyyy-MM-dd'), 1);
  if (weekday === 6) return rangeFrom(local.toFormat('yyyy-MM-dd'), 2);
  const saturday = local.plus({ days: 6 - weekday });
  return rangeFrom(saturday.toFormat('yyyy-MM-dd'), 2);
}

function calendarDate(year: number, month: number, day: number): string | null {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isRealDate(iso) ? iso : null;
}

function isRealDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false;
  return DateTime.fromISO(iso, { zone: 'utc' }).toFormat('yyyy-MM-dd') === iso;
}

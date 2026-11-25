import { DateTime } from 'luxon';
import { calendarDay, listingTimeZone } from '../inspection/pickup-photo-rules';

export const PIN_RETIRED_MESSAGE = 'Update the app to start this rental';
export const START_WINDOW_CODE = 'RENTAL_START_WINDOW';

/** 00:00 on the start calendar day in the listing time zone. */
export function startOpensAt(startAt: Date, timeZone: string): Date {
  const local = DateTime.fromJSDate(startAt, { zone: 'utc' }).setZone(timeZone);
  if (!local.isValid) return new Date(NaN);
  return local.startOf('day').toUTC().toJSDate();
}

/** Exclusive end of the start calendar day in the listing time zone. */
export function endOfStartDay(startAt: Date, timeZone: string): Date {
  const local = DateTime.fromJSDate(startAt, { zone: 'utc' }).setZone(timeZone);
  if (!local.isValid) return new Date(NaN);
  return local.plus({ days: 1 }).startOf('day').toUTC().toJSDate();
}

export type StartWindowState = 'before' | 'open' | 'after' | 'unknown';

export function startWindowState(input: {
  now: Date;
  startAt: Date;
  endAt: Date;
  timeZone: string;
}): StartWindowState {
  if (Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
    return 'unknown';
  }
  const opens = startOpensAt(input.startAt, input.timeZone);
  if (Number.isNaN(opens.getTime())) return 'unknown';
  if (input.now.getTime() < opens.getTime()) return 'before';
  if (input.now.getTime() >= input.endAt.getTime()) return 'after';
  return 'open';
}

export function listingZoneFor(country: string | null | undefined): string {
  return listingTimeZone(country);
}

/** Unpaid Mobile Money reservations cancel at the end of the start day. */
export function reservedUnpaidDue(input: {
  now: Date;
  startAt: Date;
  timeZone: string;
  policyVersion: number | null;
  pickupInspectionPending: boolean;
}): boolean {
  if (Number.isNaN(input.startAt.getTime())) return false;
  if (input.policyVersion != null && input.pickupInspectionPending) return false;
  const deadline = endOfStartDay(input.startAt, input.timeZone);
  if (Number.isNaN(deadline.getTime())) return false;
  return input.now.getTime() >= deadline.getTime();
}

export function isNoShow(input: {
  status: string;
  actualStartAt: string | null | undefined;
  endAt: Date;
  now: Date;
}): boolean {
  if (input.status !== 'confirmed' || input.actualStartAt) return false;
  if (Number.isNaN(input.endAt.getTime())) return false;
  return input.now.getTime() >= input.endAt.getTime();
}

export function isStartDay(startAt: Date, now: Date, timeZone: string): boolean {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return calendarDay(startAt, timeZone) === calendarDay(now, timeZone);
}

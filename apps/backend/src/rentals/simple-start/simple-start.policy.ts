import { listingTimeZone } from '../inspection/listing-time-zone';
import { wallClockToInstant, wallNow } from '../wall-clock';

export const PIN_RETIRED_MESSAGE = 'Update the app to start this rental';
export const START_WINDOW_CODE = 'RENTAL_START_WINDOW';

/**
 * 00:00 on the stored start date. `start_at` is listing wall clock written as UTC
 * components (`08:00` in Douala is `...T08:00:00Z`), so a listing-zone conversion
 * shifts the pickup day by the UTC offset.
 */
export function startOpensAt(startAt: Date, _timeZone?: string): Date {
  if (Number.isNaN(startAt.getTime())) return new Date(NaN);
  return new Date(Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth(), startAt.getUTCDate()));
}

/** Exclusive end of that stored start date. */
export function endOfStartDay(startAt: Date, timeZone?: string): Date {
  const opens = startOpensAt(startAt, timeZone);
  if (Number.isNaN(opens.getTime())) return new Date(NaN);
  return new Date(opens.getTime() + 86_400_000);
}

/** Real instant the start day ends on the listing clock (shown as a countdown). */
export function endOfStartDayInstant(startAt: Date, timeZone: string): Date {
  const wall = endOfStartDay(startAt, timeZone);
  if (Number.isNaN(wall.getTime())) return wall;
  return wallClockToInstant(wall, timeZone);
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
  // start/end are listing wall clock; read "now" on that clock too.
  const now = wallNow(input.now, input.timeZone).getTime();
  if (now < opens.getTime()) return 'before';
  if (now >= input.endAt.getTime()) return 'after';
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
  return wallNow(input.now, input.timeZone).getTime() >= deadline.getTime();
}

/** Confirmed, never started, and the listing clock has reached end_at. */
export function isNoShow(input: {
  status: string;
  actualStartAt: string | null | undefined;
  endAt: Date;
  now: Date;
  timeZone: string;
}): boolean {
  if (input.status !== 'confirmed' || input.actualStartAt) return false;
  if (Number.isNaN(input.endAt.getTime())) return false;
  return wallNow(input.now, input.timeZone).getTime() >= input.endAt.getTime();
}

/** True when today on the listing clock is the stored start date. */
export function isStartDay(startAt: Date, now: Date, timeZone: string): boolean {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return startAt.toISOString().slice(0, 10) === wallNow(now, timeZone).toISOString().slice(0, 10);
}

/** True when the listing clock has reached the stored wall-clock time `at`. */
export function wallClockReached(at: Date, now: Date, timeZone: string): boolean {
  if (Number.isNaN(at.getTime()) || Number.isNaN(now.getTime())) return false;
  return wallNow(now, timeZone).getTime() >= at.getTime();
}

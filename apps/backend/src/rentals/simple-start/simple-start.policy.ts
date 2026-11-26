import { listingTimeZone } from '../inspection/pickup-photo-rules';

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

export function isStartDay(startAt: Date, now: Date, _timeZone?: string): boolean {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(now.getTime())) return false;
  return startAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
}

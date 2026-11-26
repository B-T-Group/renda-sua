import { listingTimeZone } from './inspection/listing-time-zone';
import { wallClockToInstantMs, wallNow } from './wall-clock';

/**
 * Return due time (Samuel, 26 Nov 2026). A single hourly booking started before its
 * booked start is due back at the real start + the booked hours: 14:00-16:00 started
 * at 11:00 is due at 13:00. Full-day and multi-window bookings, on-time starts and
 * late starts keep the booked end_at.
 *
 * rental_mark_started (SQL, rental_early_start_return_due) stamps
 * rental_bookings.return_due_at when the rental starts; that column is the source of
 * truth. It uses the same encoding as end_at (listing wall clock written as UTC
 * components). This file mirrors the rule for tests and reads the stored value.
 */

interface SnapshotLike {
  lines?: Array<{ kind?: string | null } | null> | null;
}

export interface ReturnDueBooking {
  end_at?: string | null;
  return_due_at?: string | null;
  rental_location_listing?: {
    business_location?: { address?: { country?: string | null } | null } | null;
  } | null;
}

/** One hourly line and nothing else. Older snapshots without lines keep end_at. */
export function isSingleHourlyBooking(snapshot: unknown): boolean {
  const lines = (snapshot as SnapshotLike | null | undefined)?.lines;
  return Array.isArray(lines) && lines.length === 1 && lines[0]?.kind === 'hourly';
}

/**
 * Wall-clock ISO the rental is due when started at `actualStartAt` (a real instant),
 * or null when the booked end_at stays the due time. Booked hours are added to the
 * real start, then read on the listing clock, so DST does not add or remove time.
 */
export function earlyStartReturnDue(input: {
  startAt: string | null | undefined;
  endAt: string | null | undefined;
  snapshot: unknown;
  actualStartAt: Date;
  timeZone: string;
}): string | null {
  const start = Date.parse(String(input.startAt ?? ''));
  const end = Date.parse(String(input.endAt ?? ''));
  const at = input.actualStartAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(at) || end <= start) {
    return null;
  }
  if (!isSingleHourlyBooking(input.snapshot)) return null;
  if (wallNow(input.actualStartAt, input.timeZone).getTime() >= start) return null;
  const due = wallNow(new Date(at + (end - start)), input.timeZone).getTime();
  return new Date(Math.min(due, end)).toISOString();
}

/** Stored return due (listing wall clock): return_due_at, else the booked end_at. */
export function bookingReturnDueAt(booking: ReturnDueBooking | null | undefined): string | null {
  return booking?.return_due_at || booking?.end_at || null;
}

export function bookingTimeZone(booking: ReturnDueBooking | null | undefined): string {
  return listingTimeZone(booking?.rental_location_listing?.business_location?.address?.country);
}

/** Real instant (ms) of the return due on the listing clock; NaN when unknown. */
export function bookingReturnDueInstantMs(
  booking: ReturnDueBooking | null | undefined,
  timeZone = bookingTimeZone(booking)
): number {
  const due = bookingReturnDueAt(booking);
  if (!due) return Number.NaN;
  return wallClockToInstantMs(Date.parse(due), timeZone);
}

import { listingTimeZone } from './inspection/listing-time-zone';
import { wallClockToInstantMs } from './wall-clock';

/**
 * Return due time. rental_bookings.end_at is the listing wall clock written as UTC
 * components (Toronto 18:00 is `T18:00:00Z`), while a return (actual_end_at, now, the
 * renter's report) is a real instant. Read the due on the listing clock before
 * comparing it with an instant.
 */

export interface ReturnDueBooking {
  end_at?: string | null;
  rental_location_listing?: {
    business_location?: { address?: { country?: string | null } | null } | null;
  } | null;
}

/** Stored return due (listing wall clock): the booked end_at. */
export function bookingReturnDueAt(booking: ReturnDueBooking | null | undefined): string | null {
  return booking?.end_at || null;
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

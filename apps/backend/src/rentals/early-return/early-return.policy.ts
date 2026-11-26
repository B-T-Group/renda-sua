import { bookingReturnDueInstantMs, bookingTimeZone, type ReturnDueBooking } from '../return-due';

/**
 * Early return: the renter (or the business) ends an active rental before the
 * return is due. The renter still pays the full booked price, so an early return
 * never owes overtime. "Early" is derived, never stored: the return instant
 * (actual_end_at, or the renter's report) is before the due instant.
 *
 * The due is listing wall clock written as UTC components (end_at, and
 * return_due_at after an hourly early start, #881), so it is
 * read on the listing clock before it is compared with a real instant.
 */

export type EarlyReturnBooking = ReturnDueBooking;

export interface OvertimeSettlement {
  overtimeHours: number;
  overtimeAmount: number;
  contract: number;
  stripeCharge: number;
}

export function earlyReturnZone(booking: EarlyReturnBooking | null | undefined): string {
  return bookingTimeZone(booking);
}

/** Real instant (ms) when the return is due; NaN when unknown. */
export function returnDueInstantMs(
  booking: EarlyReturnBooking | null | undefined,
  timeZone = earlyReturnZone(booking)
): number {
  return bookingReturnDueInstantMs(booking, timeZone);
}

/** True when a real return instant is strictly before the due instant. */
export function isEarlyReturn(
  returnedAtIso: string | null | undefined,
  booking: EarlyReturnBooking | null | undefined,
  timeZone = earlyReturnZone(booking)
): boolean {
  const at = returnedAtIso ? Date.parse(returnedAtIso) : Number.NaN;
  const due = returnDueInstantMs(booking, timeZone);
  return Number.isFinite(at) && Number.isFinite(due) && at < due;
}

/** An early return pays exactly the contract: no overtime, whatever the hour math said. */
export function settleEarlyAsContract<T extends OvertimeSettlement>(
  settlement: T,
  early: boolean
): T {
  if (!early) return settlement;
  return { ...settlement, overtimeHours: 0, overtimeAmount: 0, stripeCharge: settlement.contract };
}

/**
 * Settlement return time. The business may pass a corrected time; otherwise a
 * renter report wins over "now" so a slow confirm never turns an early return
 * into a late one.
 */
export function defaultReturnAt(
  input: string | null | undefined,
  renterReportedAt: string | null | undefined,
  now: Date
): Date {
  if (input?.trim()) return new Date(input.trim());
  if (renterReportedAt && Number.isFinite(Date.parse(renterReportedAt))) {
    return new Date(renterReportedAt);
  }
  return now;
}

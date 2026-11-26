import { endOfStartDay } from '../simple-start/simple-start.policy';
import { wallNow } from '../wall-clock';

/**
 * Samuel, 26 Nov 2026 (17:24): a small flat commitment amount, counts toward the total.
 * Stripe-rail countries: 1.00 in the listing currency. Non-Stripe (Mobile Money): 150 (XAF / XOF).
 */
export const RESERVATION_FEE_STRIPE = 1;
export const RESERVATION_FEE_MOBILE_MONEY = 150;

export type ReservationFeeStatus =
  | 'none'
  | 'pending'
  | 'paid'
  | 'applied'
  | 'forfeited'
  | 'refunded'
  | 'failed';

export type ReservationFeeRail = 'card' | 'wallet' | 'mobile_money';

/** Flat fee, capped at the total. 0 when the listing has no fee or the total is not positive. */
export function reservationFeeFor(input: {
  enabled: boolean | null | undefined;
  total: number;
  rail: string | null | undefined;
}): number {
  const total = Number(input.total);
  if (input.enabled !== true || !Number.isFinite(total) || total <= 0) return 0;
  const flat = input.rail === 'stripe' ? RESERVATION_FEE_STRIPE : RESERVATION_FEE_MOBILE_MONEY;
  return Math.min(total, flat);
}

/** What is left to pay at pickup. The fee only counts once it was paid. */
export function dueAtPickup(input: {
  total: number;
  feeAmount: number | null | undefined;
  feeStatus: string | null | undefined;
}): number {
  const total = Number(input.total) || 0;
  const fee = feePaidAmount(input.feeAmount, input.feeStatus);
  return round2(Math.max(0, total - fee));
}

/** Fee money already with Rendasua for this booking (held, or applied at settlement). */
export function feePaidAmount(amount: number | null | undefined, status: string | null | undefined): number {
  if (status !== 'paid' && status !== 'applied') return 0;
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export type FeeCancelReason =
  | 'renter_cancel'
  | 'business_cancel'
  | 'not_as_described'
  | 'unresolved_flag'
  | 'unpaid_expired'
  | 'no_show'
  | 'offer_lost';

/**
 * Refund table (README §4):
 * - renter cancels before the start day (listing clock): refund
 * - renter cancels on/after the start day, unpaid at the end of the start day, no-show: kept
 * - business cancels, item does not match, flag unresolved, offer lost before reserve: refund
 */
export function feeOutcome(input: {
  reason: FeeCancelReason;
  now: Date;
  startAt: Date;
  timeZone: string;
}): 'refund' | 'forfeit' {
  switch (input.reason) {
    case 'business_cancel':
    case 'not_as_described':
    case 'unresolved_flag':
    case 'offer_lost':
      return 'refund';
    case 'unpaid_expired':
    case 'no_show':
      return 'forfeit';
    case 'renter_cancel':
      return beforeStartDay(input.now, input.startAt, input.timeZone) ? 'refund' : 'forfeit';
  }
}

/** True before 00:00 of the stored start date on the listing clock. */
export function beforeStartDay(now: Date, startAt: Date, timeZone: string): boolean {
  if (Number.isNaN(startAt.getTime())) return true;
  const opens = endOfStartDay(startAt, timeZone).getTime() - 86_400_000;
  return wallNow(now, timeZone).getTime() < opens;
}

/** Stripe entity id for the fee payment. Kept apart from the booking's contract payment. */
export const RESERVATION_FEE_ENTITY_PREFIX = 'fee:';

export function reservationFeeEntityId(bookingNumber: string): string {
  return `${RESERVATION_FEE_ENTITY_PREFIX}${bookingNumber}`;
}

/** Booking number when the payment transaction is a reservation fee, else null. */
export function bookingNumberFromFeeEntity(entityId: string | null | undefined): string | null {
  const id = String(entityId ?? '');
  if (!id.startsWith(RESERVATION_FEE_ENTITY_PREFIX)) return null;
  const number = id.slice(RESERVATION_FEE_ENTITY_PREFIX.length).trim();
  return number || null;
}

/** Card rentals keep the ~6-day limit, now measured from pickup (the hold is placed at Pay and start). */
export function pickupAuthFits(input: {
  startAt: Date;
  endAt: Date;
  authWindowDays: number;
  reviewHours: number;
}): boolean {
  const span = input.endAt.getTime() - input.startAt.getTime();
  if (!Number.isFinite(span) || span <= 0) return false;
  const limit = input.authWindowDays * 86_400_000 - Math.max(0, input.reviewHours) * 3_600_000;
  return span <= limit;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

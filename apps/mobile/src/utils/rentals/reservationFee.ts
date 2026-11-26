import { showsCardDeposit } from './cardDeposit';

/**
 * Reserve now, pay at pickup (renter side).
 * The server stamps the path on the booking when the offer is created:
 * - `card_pay_at_pickup`: card markets, nothing is held at reservation; Pay & start
 *   authorizes (rental − paid fee + deposit) after the item check is accepted.
 * - `reservation_fee_amount`: optional fee (listing setting, off by default). It counts
 *   toward the total, so the amount due at pickup is the total minus a paid fee.
 * Bookings without these fields keep their current path.
 */
export interface PayAtPickupFields {
  status?: string | null;
  currency?: string | null;
  total_amount?: number | string | null;
  security_deposit_amount?: number | string | null;
  payment_timing?: string | null;
  payment_status?: string | null;
  card_pay_at_pickup?: boolean | null;
  reservation_fee_amount?: number | string | null;
  reservation_fee_status?: string | null;
}

export type ReserveMode =
  /** Legacy card path: the rental + deposit is authorized when the renter reserves. */
  | 'card_upfront'
  /** Nothing to pay now; everything is paid at pickup. */
  | 'free'
  /** A reservation fee is paid now and counts toward the total. */
  | 'fee';

function amount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round(value: number, currency: string | null | undefined): number {
  return isFcfa(currency) ? Math.round(value) : Number(value.toFixed(2));
}

export function isFcfa(currency: string | null | undefined): boolean {
  const code = (currency ?? '').trim().toUpperCase();
  return code === 'XAF' || code === 'XOF';
}

export function reservationFee(b: PayAtPickupFields | null | undefined): number {
  return amount(b?.reservation_fee_amount);
}

/** The fee counts toward the total only once it is paid (or already applied). */
export function feePaid(b: PayAtPickupFields | null | undefined): number {
  if (!b) return 0;
  const status = b.reservation_fee_status ?? 'none';
  return status === 'paid' || status === 'applied' ? reservationFee(b) : 0;
}

export function dueAtPickup(b: PayAtPickupFields | null | undefined): number {
  if (!b) return 0;
  return round(Math.max(0, amount(b.total_amount) - feePaid(b)), b.currency);
}

/** Deposit held on the card at Pay & start. XAF/XOF rentals have no deposit. */
export function pickupDepositHold(b: PayAtPickupFields | null | undefined): number {
  if (!b || !showsCardDeposit(b.currency)) return 0;
  return amount(b.security_deposit_amount);
}

/** Card pay at pickup that still needs its Pay & start authorization. */
export function cardDueAtPickup(b: PayAtPickupFields | null | undefined): boolean {
  if (!b || b.card_pay_at_pickup !== true) return false;
  return b.payment_status !== 'authorized' && b.payment_status !== 'paid';
}

/**
 * How the renter reserves an offer. Card markets keep the up-front hold unless the server
 * stamped `card_pay_at_pickup`; non-card markets always reserve for free or with the fee.
 */
export function reserveMode(
  b: PayAtPickupFields | null | undefined,
  isStripeRail: boolean | undefined
): ReserveMode {
  if (isStripeRail && b?.card_pay_at_pickup !== true) return 'card_upfront';
  return reservationFee(b) > 0 ? 'fee' : 'free';
}

/** Show the "Reserved · pay at pickup" payment card on the booking. */
export function showsPayAtPickupCard(b: PayAtPickupFields | null | undefined): boolean {
  if (!b) return false;
  if (b.status !== 'reserved' && b.status !== 'confirmed') return false;
  if (b.status === 'confirmed' && b.payment_status !== 'pending') return false;
  return b.payment_timing === 'pay_at_pickup' || b.card_pay_at_pickup === true;
}

export type FeeOutcomeKey = 'paid' | 'pending' | 'refunded' | 'kept' | 'applied' | 'none';

export function feeOutcome(b: PayAtPickupFields | null | undefined): FeeOutcomeKey {
  if (!b || reservationFee(b) <= 0) return 'none';
  switch (b.reservation_fee_status) {
    case 'paid':
      return 'paid';
    case 'applied':
      return 'applied';
    case 'refunded':
      return 'refunded';
    case 'forfeited':
      return 'kept';
    case 'pending':
    case 'failed':
    case 'none':
    default:
      return 'pending';
  }
}

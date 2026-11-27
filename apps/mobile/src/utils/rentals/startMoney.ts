import { showsCardDeposit } from './cardDeposit';
import { cardDueAtPickup, dueAtPickup, pickupDepositHold } from './reservationFee';

/** Server fields behind the money line on the start card and the "Start rental?" sheet. */
export interface StartMoneyBooking {
  currency: string;
  total_amount?: number | string | null;
  security_deposit_amount?: number | string | null;
  authorized_amount?: number | string | null;
  payment_status?: string | null;
  payment_timing?: string | null;
  card_pay_at_pickup?: boolean | null;
  reservation_fee_amount?: number | string | null;
  reservation_fee_status?: string | null;
  accept_start_preview?: {
    payment_rail?: string | null;
    amount_due_at_pickup?: number | string | null;
    paid_rail?: string | null;
    deposit_hold_amount?: number | string | null;
  } | null;
}

/**
 * What the renter really has held or paid before the rental starts.
 * - card: the Stripe authorization (`authorized_amount`), which is the rental total plus the
 *   security deposit in one manual-capture hold. The split subline shows only when the hold
 *   equals rental + deposit, so the parts always add up to the held amount.
 * - momo_due: nothing paid yet; the amount is charged by Mobile Money when the renter starts.
 * - wallet_due: not paid yet, but the server's start preview (`payment_rail: 'wallet'`) says the
 *   wallet covers it, so Start takes it from the wallet.
 * - paid: already paid (XAF/XOF have no deposit); `via` says how when the server knows.
 * - card_due: reserve now, pay at pickup on a card. Nothing is held yet; Pay & start charges
 *   the amount due (rental minus a paid reservation fee) and holds the deposit.
 */
export type StartMoney =
  | { kind: 'card'; held: number; rental: number; deposit: number; split: boolean }
  | { kind: 'momo_due'; amount: number }
  | { kind: 'wallet_due'; amount: number }
  | { kind: 'paid'; amount: number; via: 'mobile_money' | 'wallet' | null }
  | { kind: 'card_due'; amount: number; deposit: number };

export function startMoney(booking: StartMoneyBooking): StartMoney {
  const rental = amount(booking.total_amount);
  if (cardDueAtPickup(booking)) {
    const preview = booking.accept_start_preview;
    const due = preview?.payment_rail === 'card' ? amount(preview.amount_due_at_pickup) : 0;
    const deposit = preview?.deposit_hold_amount != null ? amount(preview.deposit_hold_amount) : pickupDepositHold(booking);
    return { kind: 'card_due', amount: due > 0 ? due : dueAtPickup(booking), deposit };
  }
  if (booking.payment_status === 'authorized' || !isFcfa(booking.currency)) {
    return cardHold(booking, rental);
  }
  if (booking.payment_status === 'paid') {
    return { kind: 'paid', amount: rental, via: paidVia(booking.accept_start_preview?.paid_rail) };
  }
  const due = amount(booking.accept_start_preview?.amount_due_at_pickup);
  // A paid reservation fee counts toward the total, so the fallback is total − fee.
  const value = due > 0 ? due : dueAtPickup(booking) || rental;
  // Server preview: the renter's wallet covers the total, so Start takes it from the wallet, not Mobile Money.
  if (booking.accept_start_preview?.payment_rail === 'wallet') return { kind: 'wallet_due', amount: value };
  return { kind: 'momo_due', amount: value };
}

function cardHold(booking: StartMoneyBooking, rental: number): StartMoney {
  const deposit = showsCardDeposit(booking.currency) ? amount(booking.security_deposit_amount) : 0;
  const authorized = amount(booking.authorized_amount);
  const held = authorized > 0 ? authorized : round2(rental + deposit);
  const split = deposit > 0 && Math.abs(held - (rental + deposit)) < 0.01;
  return { kind: 'card', held, rental, deposit, split };
}

function paidVia(value: string | null | undefined): 'mobile_money' | 'wallet' | null {
  if (value === 'mobile_money' || value === 'wallet') return value;
  return null;
}

function isFcfa(currency: string | null | undefined): boolean {
  const code = (currency ?? '').trim().toUpperCase();
  return code === 'XAF' || code === 'XOF';
}

function amount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

/** Main line and optional grey subline, in the renter's words. */
export function startMoneyLines(
  money: StartMoney,
  format: (value: number) => string,
  t: Translate
): { main: string; sub: string | null; icon: 'card' | 'momo' | 'wallet' } {
  if (money.kind === 'card_due') {
    const main = t('rentals.payAtPickup.cardDue', '{{amount}} charged to your card at pickup', { amount: format(money.amount) });
    const sub = money.deposit > 0
      ? t('rentals.payAtPickup.cardDepositHold', '+ {{deposit}} deposit hold, released after the return', { deposit: format(money.deposit) })
      : null;
    return { main, sub, icon: 'card' };
  }
  if (money.kind === 'card') {
    const main = t('rentals.start.held', '{{amount}} held on your card', { amount: format(money.held) });
    const sub = money.split
      ? t('rentals.start.heldSplit', '{{rental}} rental · {{deposit}} security deposit', {
          rental: format(money.rental),
          deposit: format(money.deposit),
        })
      : null;
    return { main, sub, icon: 'card' };
  }
  if (money.kind === 'momo_due') {
    return { main: t('rentals.start.momoLine', 'Mobile Money · {{amount}}', { amount: format(money.amount) }), sub: null, icon: 'momo' };
  }
  if (money.kind === 'wallet_due') {
    return {
      main: t('rentals.start.walletDue', '{{amount}} will be paid from your wallet', { amount: format(money.amount) }),
      sub: null,
      icon: 'wallet',
    };
  }
  const value = format(money.amount);
  if (money.via === 'mobile_money') {
    return { main: t('rentals.start.paidMomo', '{{amount}} paid with Mobile Money', { amount: value }), sub: null, icon: 'momo' };
  }
  if (money.via === 'wallet') {
    return { main: t('rentals.start.paidWallet', '{{amount}} paid from your wallet', { amount: value }), sub: null, icon: 'wallet' };
  }
  return { main: t('rentals.start.paid', '{{amount}} paid', { amount: value }), sub: null, icon: 'wallet' };
}

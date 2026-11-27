import { confirmationTimeZone, formatConfirmationMoney } from './confirmationFormat';
import { dueAtPickup, feePaid, pickupDepositHold, type PayAtPickupFields } from './reservationFee';
import { weekdayDay, windowLabel } from './reserveSummary';

type Translate = (key: string, fallback: string, vars?: Record<string, unknown>) => string;

export interface ReservedOutcomeInput {
  reserved?: boolean;
  paymentPending?: boolean;
  checkout_url?: string;
  reservation_fee?: unknown;
}

/** Card sheet result after booking; web has no sheet, so it always passes 'none'. */
export type ReservedStripeOutcome = 'none' | 'success' | 'authorized' | 'cancelled' | 'failed' | 'pending' | 'browser';

/**
 * True when the booking is reserved for pay at pickup and nothing else is owed right now
 * (no fee, or the fee is already paid). Redirects, pending payments and legacy card-upfront
 * bookings keep their own flows.
 */
export function isReservedWithNothingDue(res: ReservedOutcomeInput, stripeOutcome: ReservedStripeOutcome = 'none'): boolean {
  if (res.checkout_url) return false;
  if (stripeOutcome === 'success') return Boolean(res.reservation_fee);
  if (stripeOutcome !== 'none') return false;
  return Boolean(res.reserved) && !res.paymentPending;
}

export interface ReservedBooking extends PayAtPickupFields {
  start_at: string;
  end_at: string;
  inspection_policy_version?: number | null;
  rental_location_listing?: {
    rental_item?: { name?: string | null } | null;
    business_location?: { name?: string | null; address?: { country?: string | null } | null } | null;
  } | null;
}

export type ReservedStepIcon = 'pin' | 'camera' | 'wallet' | 'refund';

export interface ReservedStep {
  key: string;
  icon: ReservedStepIcon;
  title: string;
  body: string;
}

export interface ReservedView {
  itemName: string | null;
  place: string | null;
  when: string;
  due: string;
  deposit: string | null;
  steps: ReservedStep[];
}

function payBody(due: string, deposit: string | null, t: Translate): string {
  if (!deposit) return t('rentals.reserved.payBody', 'At pickup, inspect the item. If everything looks good, pay {{due}} in the app and take it.', { due });
  return t('rentals.reserved.payBodyDeposit', 'At pickup, inspect the item. If everything looks good, pay {{due}} in the app and take it. A {{deposit}} deposit is also held on your card.', { due, deposit });
}

function cancelBody(fee: string | null, day: string, t: Translate): string {
  if (!fee) return t('rentals.reserved.cancelBody', 'You can cancel for free before the rental starts.');
  return t('rentals.reserved.cancelBodyFee', 'Cancel before {{day}} and your {{fee}} reservation fee is refunded.', { day, fee });
}

function buildSteps(p: { b: ReservedBooking; when: string; place: string | null; due: string; deposit: string | null; fee: string | null; language: string; t: Translate }): ReservedStep[] {
  const { b, when, place, due, deposit, fee, language, t } = p;
  const steps: ReservedStep[] = [
    {
      key: 'collect',
      icon: 'pin',
      title: t('rentals.reserved.collectTitle', 'Collect your item'),
      body: place
        ? t('rentals.reserved.collectBody', 'At {{when}}, go to {{place}} to collect it.', { when, place })
        : t('rentals.reserved.collectBodyNoPlace', 'At {{when}}, go to the pickup place to collect it.', { when }),
    },
  ];
  if (b.inspection_policy_version != null) {
    steps.push({
      key: 'check',
      icon: 'camera',
      title: t('rentals.reserved.checkTitle', 'Check the item'),
      body: t('rentals.reserved.checkBody', 'The business shows you the item. Check it against the photos before you accept it.'),
    });
  }
  steps.push({ key: 'pay', icon: 'wallet', title: t('rentals.reserved.payTitle', 'Pay and take it'), body: payBody(due, deposit, t) });
  steps.push({ key: 'cancel', icon: 'refund', title: t('rentals.reserved.cancelTitle', 'Plans changed?'), body: cancelBody(fee, weekdayDay(b.start_at, language), t) });
  return steps;
}

/** Everything the "You're reserved" screen shows, shared by mobile and web. */
export function buildReservedView(b: ReservedBooking, language: string, t: Translate): ReservedView {
  const listing = b.rental_location_listing;
  const zone = confirmationTimeZone(listing?.business_location?.address?.country, b.currency);
  const money = (n: number) => formatConfirmationMoney(n, b.currency ?? 'CAD', language);
  const when = windowLabel({ start_at: b.start_at, end_at: b.end_at }, language, zone);
  const place = listing?.business_location?.name?.trim() || null;
  const hold = pickupDepositHold(b);
  const paidFee = feePaid(b);
  const due = money(dueAtPickup(b));
  const deposit = hold > 0 ? money(hold) : null;
  const fee = paidFee > 0 ? money(paidFee) : null;
  return {
    itemName: listing?.rental_item?.name?.trim() || null,
    place,
    when,
    due,
    deposit,
    steps: buildSteps({ b, when, place, due, deposit, fee, language, t }),
  };
}

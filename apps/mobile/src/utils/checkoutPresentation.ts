import type {
  DedicatedCoveredSlot,
  FulfillmentMethod,
  PaymentTiming,
  ResolvedCheckoutConfig,
} from '../types/checkout';

export type PaymentChoiceId =
  | 'wallet'
  | 'card'
  | 'mobile_money'
  | 'pay_at_delivery'
  | 'pay_at_pickup'
  | 'deposit'
  | 'pay_after_confirm'
  | 'diaspora';

export interface CheckoutPresentation {
  fulfillment: FulfillmentMethod[];
  payments: PaymentChoiceId[];
  showSchedule: boolean;
  /** #594: delivery is offered only for the dedicated-covered slots (no ASAP). */
  deliveryScheduledOnly: boolean;
}

type PreflightSlice = Pick<
  ResolvedCheckoutConfig,
  | 'checkout_method'
  | 'groups'
  | 'delivery_availability'
  | 'can_pay_with_wallet'
  | 'pay_after_merchant_confirm_eligible'
  | 'deposit_required'
  | 'diaspora'
  | 'schedule_allowed'
  | 'momo_pay_now_delivery_enabled'
>;

/** Only the fulfillment and payment choices this order can actually use. */
export function buildCheckoutPresentation(
  preflight: PreflightSlice | null | undefined,
  fulfillment: FulfillmentMethod
): CheckoutPresentation {
  if (!preflight) return { fulfillment: [], payments: [], showSchedule: false, deliveryScheduledOnly: false };
  // Covered slots only matter while delivery itself is offered (it needs a payable method).
  const scheduledOnly =
    resolveDeliveryCoverage(preflight.delivery_availability).scheduledOnly &&
    deliveryHasPayableTiming(preflight);
  return {
    fulfillment: fulfillmentChoices(preflight),
    payments: paymentChoices(preflight, fulfillment),
    showSchedule:
      fulfillment !== 'pickup' &&
      (preflight.schedule_allowed === true || scheduledOnly),
    deliveryScheduledOnly: scheduledOnly && fulfillment === 'delivery',
  };
}

function fulfillmentChoices(preflight: PreflightSlice): FulfillmentMethod[] {
  const groups = preflight.groups ?? [];
  const choices: FulfillmentMethod[] = [];
  if (groups.length > 0 && groups.every((group) => group.pickup_eligible)) choices.push('pickup');
  if (
    deliveryHasPayableTiming(preflight) &&
    (preflight.delivery_availability?.available !== false ||
      resolveDeliveryCoverage(preflight.delivery_availability).scheduledOnly)
  ) {
    choices.push('delivery');
  }
  if (groups.length > 0 && groups.every((group) => group.shipping_eligible)) choices.push('shipping');
  return choices;
}

/**
 * Delivery needs a method the shopper can pay with: pay now or pay at delivery.
 * When pay at pickup is the only allowed timing, delivery (ASAP or a covered slot)
 * can never be paid for, so it is not offered. Unknown or empty timings, pay-after
 * and diaspora checkouts keep today's behaviour.
 */
export function deliveryHasPayableTiming(preflight: PreflightSlice): boolean {
  if (preflight.diaspora?.is_diaspora) return true;
  if (preflight.pay_after_merchant_confirm_eligible) return true;
  const timings = sharedTimings(preflight);
  if (timings.length === 0) return true;
  return timings.includes('pay_now') || timings.includes('pay_at_delivery');
}

function paymentChoices(preflight: PreflightSlice, fulfillment: FulfillmentMethod): PaymentChoiceId[] {
  if (preflight.diaspora?.is_diaspora) return ['diaspora'];
  if (preflight.pay_after_merchant_confirm_eligible) return ['pay_after_confirm'];
  const timings = sharedTimings(preflight);
  const choices: PaymentChoiceId[] = [];
  if (preflight.can_pay_with_wallet) choices.push('wallet');
  if (preflight.deposit_required) choices.push('deposit');
  if (timings.includes('pay_at_delivery') && fulfillment === 'delivery') choices.push('pay_at_delivery');
  if (timings.includes('pay_at_pickup') && fulfillment === 'pickup') choices.push('pay_at_pickup');
  if (canPayNow(preflight, timings, fulfillment)) {
    choices.push(preflight.checkout_method === 'STRIPE' ? 'card' : 'mobile_money');
  }
  return choices;
}

function sharedTimings(preflight: PreflightSlice): PaymentTiming[] {
  const groups = preflight.groups ?? [];
  if (groups.length === 0) return [];
  return groups[0].allowed_payment_timings.filter((timing) =>
    groups.every((group) => group.allowed_payment_timings.includes(timing))
  );
}

function canPayNow(
  preflight: PreflightSlice,
  timings: PaymentTiming[],
  fulfillment: FulfillmentMethod
): boolean {
  if (!timings.includes('pay_now')) return false;
  if (preflight.checkout_method === 'MOBILE_MONEY' && fulfillment === 'delivery') {
    return preflight.momo_pay_now_delivery_enabled === true;
  }
  return true;
}

export type { DedicatedCoveredSlot };

export interface DeliveryCoverageInput {
  available?: boolean;
  delivery_asap_available?: boolean;
  dedicated_covered_slots?: DedicatedCoveredSlot[] | null;
}

export interface DeliveryCoverage {
  /** ASAP delivery is out, but a dedicated agent covers these scheduled slots. */
  scheduledOnly: boolean;
  /** Only the covered slots, sorted by date then start; empty unless scheduledOnly. */
  coveredSlots: DedicatedCoveredSlot[];
}

/**
 * Reads the dedicated-agent coverage fields. They are only sent when
 * `dedicated_agents_enabled` is on, so with the flag off this always returns
 * `{ scheduledOnly: false, coveredSlots: [] }` and checkout is unchanged.
 */
export function resolveDeliveryCoverage(
  availability: DeliveryCoverageInput | null | undefined
): DeliveryCoverage {
  const slots = Array.isArray(availability?.dedicated_covered_slots)
    ? availability.dedicated_covered_slots.filter(
        (slot) => Boolean(slot?.slot_id && slot?.date)
      )
    : [];
  const asap = availability?.delivery_asap_available ?? availability?.available;
  if (asap !== false || slots.length === 0) {
    return { scheduledOnly: false, coveredSlots: [] };
  }
  const coveredSlots = [...slots].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)
  );
  return { scheduledOnly: true, coveredSlots };
}

/** True when the chosen window is one of the covered (date, slot_id) pairs. */
export function isCoveredDeliveryWindow(
  window: { slot_id: string; preferred_date: string } | null | undefined,
  coveredSlots: DedicatedCoveredSlot[]
): boolean {
  if (!window) return false;
  return coveredSlots.some(
    (slot) => slot.slot_id === window.slot_id && slot.date === window.preferred_date
  );
}

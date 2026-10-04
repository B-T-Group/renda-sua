export type FulfillmentMethod = 'delivery' | 'pickup' | 'shipping';
export type PaymentTiming = 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
export type PaymentChoiceId =
  | 'wallet'
  | 'card'
  | 'mobile_money'
  | 'pay_at_delivery'
  | 'pay_at_pickup'
  | 'deposit'
  | 'pay_after_confirm'
  | 'diaspora';

export interface CheckoutPresentationGroup {
  allowed_payment_timings: PaymentTiming[];
  pickup_eligible?: boolean;
  shipping_eligible?: boolean;
}

export interface CheckoutPresentationInput {
  checkout_method: 'STRIPE' | 'MOBILE_MONEY';
  groups: CheckoutPresentationGroup[];
  delivery_availability?: { available: boolean } | null;
  can_pay_with_wallet?: boolean | null;
  pay_after_merchant_confirm_eligible?: boolean;
  deposit_required?: boolean | null;
  diaspora?: { is_diaspora: boolean } | null;
  schedule_allowed?: boolean;
  momo_pay_now_delivery_enabled?: boolean | null;
}

export interface CheckoutPresentation {
  fulfillment: FulfillmentMethod[];
  payments: PaymentChoiceId[];
  showSchedule: boolean;
}

/** Only the fulfillment and payment choices this order can actually use. */
export function buildCheckoutPresentation(
  preflight: CheckoutPresentationInput | null | undefined,
  fulfillment: FulfillmentMethod
): CheckoutPresentation {
  if (!preflight) return { fulfillment: [], payments: [], showSchedule: false };
  return {
    fulfillment: fulfillmentChoices(preflight),
    payments: paymentChoices(preflight, fulfillment),
    showSchedule: preflight.schedule_allowed === true && fulfillment !== 'pickup',
  };
}

function fulfillmentChoices(preflight: CheckoutPresentationInput): FulfillmentMethod[] {
  const groups = preflight.groups ?? [];
  const choices: FulfillmentMethod[] = [];
  if (groups.length > 0 && groups.every((group) => group.pickup_eligible)) choices.push('pickup');
  if (preflight.delivery_availability?.available !== false) choices.push('delivery');
  if (groups.length > 0 && groups.every((group) => group.shipping_eligible)) choices.push('shipping');
  return choices;
}

function paymentChoices(
  preflight: CheckoutPresentationInput,
  fulfillment: FulfillmentMethod
): PaymentChoiceId[] {
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

function sharedTimings(preflight: CheckoutPresentationInput): PaymentTiming[] {
  const groups = preflight.groups ?? [];
  if (groups.length === 0) return [];
  return groups[0].allowed_payment_timings.filter((timing) =>
    groups.every((group) => group.allowed_payment_timings.includes(timing))
  );
}

function canPayNow(
  preflight: CheckoutPresentationInput,
  timings: PaymentTiming[],
  fulfillment: FulfillmentMethod
): boolean {
  if (!timings.includes('pay_now')) return false;
  if (preflight.checkout_method === 'MOBILE_MONEY' && fulfillment === 'delivery') {
    return preflight.momo_pay_now_delivery_enabled === true;
  }
  return true;
}

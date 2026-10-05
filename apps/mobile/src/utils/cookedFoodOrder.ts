import type { Order } from '../types/agent';

export type FoodServiceStyle = 'eat_in' | 'take_out';

/** Cooked pickup is eat-in while the flag is set, otherwise take-out. */
export function foodServiceStyle(order: {
  is_cooked_food_pickup?: boolean | null;
  eat_in?: boolean | null;
}): FoodServiceStyle | null {
  if (order.is_cooked_food_pickup !== true && order.eat_in !== true) return null;
  return order.eat_in === true ? 'eat_in' : 'take_out';
}

/** Unpaid order whose kitchen said there is no table. */
export function showEatInUnavailableNotice(order: {
  eat_in?: boolean | null;
  eat_in_unavailable?: boolean | null;
  payment_status?: string | null;
}): boolean {
  if (order.eat_in !== true || order.eat_in_unavailable !== true) return false;
  return order.payment_status !== 'paid' && order.payment_status !== 'authorized';
}

export type CookedFoodOrderLike = Pick<
  Order,
  | 'is_cooked_food_pickup'
  | 'eat_in'
  | 'eat_in_unavailable'
  | 'fulfillment_method'
  | 'fulfillment_timing'
  | 'pay_after_merchant_confirm'
  | 'payment_status'
  | 'current_status'
  | 'delivery_time_windows'
  | 'order_items'
>;

function everyLineIsCookedFood(
  lines: Array<{ is_cooked_food?: boolean | null } | null | undefined>
): boolean {
  if (!lines.length) return false;
  return lines.every((line) => line?.is_cooked_food === true);
}

function lineCookedFlags(order: CookedFoodOrderLike) {
  return (order.order_items ?? []).map((line) => ({
    is_cooked_food:
      (line as { is_cooked_food?: boolean | null }).is_cooked_food ??
      (line as { item?: { is_cooked_food?: boolean | null } | null }).item
        ?.is_cooked_food,
  }));
}

/**
 * Mirrors backend `isCookedFoodOrderSnapshot`: cooked-only behaviour (kitchen wording,
 * ready-in prompt) keys on line snapshots, not on pay_after_merchant_confirm
 * (also set for flagged-location goods).
 */
export function isCookedFoodOrderSnapshot(order: CookedFoodOrderLike): boolean {
  if (order.is_cooked_food_pickup === true) return true;
  const flags = lineCookedFlags(order).map((l) => l.is_cooked_food);
  if (flags.length > 0 && flags.every((f) => typeof f === 'boolean')) {
    return flags.every((f) => f === true);
  }
  return order.pay_after_merchant_confirm === true;
}

function isAsapOrder(order: CookedFoodOrderLike): boolean {
  return (
    order.fulfillment_timing === 'asap' ||
    (order.delivery_time_windows?.length ?? 0) === 0
  );
}

function isAsapPickupOrder(order: CookedFoodOrderLike): boolean {
  if (order.fulfillment_method !== 'pickup') return false;
  return isAsapOrder(order);
}

function isAsapDeliveryOrder(order: CookedFoodOrderLike): boolean {
  if (order.fulfillment_method !== 'delivery') return false;
  return isAsapOrder(order);
}

/**
 * Merchant confirm uses ready-in flow for ASAP cooked-food pickup, or ASAP
 * delivery with pay_after_merchant_confirm (MoMo).
 */
export function shouldUseCookedFoodConfirmModal(order: CookedFoodOrderLike): boolean {
  if (isAsapPickupOrder(order)) {
    if (order.is_cooked_food_pickup === true) return true;
    return everyLineIsCookedFood(lineCookedFlags(order));
  }
  if (
    isAsapDeliveryOrder(order) &&
    order.pay_after_merchant_confirm === true &&
    isCookedFoodOrderSnapshot(order)
  ) {
    return true;
  }
  return false;
}

/**
 * Guided confirm for ASAP pay-after orders that are NOT cooked food (flagged-location
 * goods): no ready-in prompt, just the pay-after explanation.
 */
export function isStorePayAfterConfirmOrder(order: CookedFoodOrderLike): boolean {
  if (order.pay_after_merchant_confirm !== true) return false;
  if (isCookedFoodOrderSnapshot(order)) return false;
  return isAsapPickupOrder(order) || isAsapDeliveryOrder(order);
}

/** True when the guided (pay-after aware) confirm dialog should open. */
export function shouldUseGuidedConfirmModal(order: CookedFoodOrderLike): boolean {
  return shouldUseCookedFoodConfirmModal(order) || isStorePayAfterConfirmOrder(order);
}

export function isCookedFoodPickupFlow(order: CookedFoodOrderLike): boolean {
  return shouldUseCookedFoodConfirmModal(order);
}

export type PickupReadyCopyMode = 'pay_at_pickup' | 'complete_paid' | 'pin';

/**
 * Ready-for-pickup client copy: unpaid pay-at-pickup → Pay; already-paid cooked /
 * pay-after (or paid pay-at-pickup) → Complete so merchant is paid; else PIN.
 */
export function resolvePickupReadyCopyMode(order: {
  payment_timing?: string | null;
  payment_status?: string | null;
  pay_after_merchant_confirm?: boolean | null;
  is_cooked_food_pickup?: boolean | null;
}): PickupReadyCopyMode {
  const unpaidPayAtPickup =
    order.payment_timing === 'pay_at_pickup' &&
    order.payment_status !== 'paid' &&
    order.payment_status !== 'authorized';
  if (unpaidPayAtPickup) return 'pay_at_pickup';
  if (
    order.is_cooked_food_pickup === true ||
    order.pay_after_merchant_confirm === true ||
    order.payment_timing === 'pay_at_pickup'
  ) {
    return 'complete_paid';
  }
  return 'pin';
}

export function isCookedFoodAwaitingClientPayment(
  order: CookedFoodOrderLike
): boolean {
  if (order.pay_after_merchant_confirm !== true) return false;
  // Includes flagged-location goods: the store must wait for payment.
  if (!shouldUseGuidedConfirmModal(order)) return false;
  const payment = order.payment_status;
  return payment !== 'paid' && payment !== 'authorized';
}

/**
 * Paid (or authorized) COOKED-food pay-after order — cooking / ready stages.
 * Non-cooked pay-after orders are excluded: the store may cancel those after payment
 * and the client is refunded.
 */
export function isCookedFoodPayAfterPaid(
  order: CookedFoodOrderLike
): boolean {
  if (order.pay_after_merchant_confirm !== true) return false;
  if (!isCookedFoodOrderSnapshot(order)) return false;
  const payment = order.payment_status;
  return payment === 'paid' || payment === 'authorized';
}

/**
 * Business may open Fail pickup/handoff from ready_for_pickup for cooked food
 * (pickup, or delivery before an agent is assigned).
 */
export function isCookedFoodReadyFailEligible(
  order: CookedFoodOrderLike & {
    assigned_agent_id?: string | null;
  }
): boolean {
  if (order.current_status !== 'ready_for_pickup') return false;
  const cooked =
    order.is_cooked_food_pickup === true ||
    (order.pay_after_merchant_confirm === true && isCookedFoodOrderSnapshot(order)) ||
    shouldUseCookedFoodConfirmModal(order);
  if (!cooked) return false;
  const paid =
    order.payment_status === 'paid' || order.payment_status === 'authorized';
  if (!paid) return false;
  if (order.fulfillment_method === 'delivery' && order.assigned_agent_id) {
    return false;
  }
  return true;
}

export function isCookedFoodStartCookingPriority(
  order: CookedFoodOrderLike
): boolean {
  if (!shouldUseCookedFoodConfirmModal(order)) return false;
  // Flagged-location goods are marked ready by the store, not "cooked".
  if (!isCookedFoodOrderSnapshot(order)) return false;
  const status = order.current_status ?? '';
  if (status === 'preparing') return true;
  if (status !== 'confirmed') return false;
  if (isCookedFoodAwaitingClientPayment(order)) return false;
  const payment = order.payment_status;
  return payment === 'paid' || payment === 'authorized';
}

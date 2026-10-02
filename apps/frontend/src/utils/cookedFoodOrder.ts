import { everyLineIsCookedFood } from '../constants/food';

export type CookedFoodOrderLike = {
  is_cooked_food_pickup?: boolean | null;
  fulfillment_method?: string | null;
  fulfillment_timing?: string | null;
  pay_after_merchant_confirm?: boolean | null;
  payment_status?: string | null;
  current_status?: string | null;
  delivery_time_windows?: unknown[] | null;
  order_items?: Array<{
    is_cooked_food?: boolean | null;
    item?: { is_cooked_food?: boolean | null } | null;
  }> | null;
};

function lineCookedFlags(order: CookedFoodOrderLike) {
  return (order.order_items ?? []).map((line) => ({
    is_cooked_food: line?.is_cooked_food ?? line?.item?.is_cooked_food,
  }));
}

/**
 * Mirrors backend `isCookedFoodOrderSnapshot`: cooked-only behaviour (kitchen wording,
 * ready-in prompt, auto-prepare) keys on line snapshots, not on pay_after_merchant_confirm
 * (which is also set for flagged-location goods).
 */
export function isCookedFoodOrderSnapshot(order: CookedFoodOrderLike): boolean {
  if (order.is_cooked_food_pickup === true) return true;
  const lines = order.order_items ?? [];
  const flags = lines.map((l) => l?.is_cooked_food ?? l?.item?.is_cooked_food);
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

export function isAsapPickupOrder(order: CookedFoodOrderLike): boolean {
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
 * Merchant confirm modal for ASAP pay-after orders that are NOT cooked food
 * (flagged-location goods): no ready-in prompt, just the pay-after explanation.
 * Use together with `shouldUseCookedFoodConfirmModal` to decide whether to open
 * the guided confirm dialog at all.
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
  // Applies to flagged-location goods too (pay-after, unpaid): the store must wait for payment.
  if (!shouldUseGuidedConfirmModal(order)) return false;
  const payment = order.payment_status;
  return payment !== 'paid' && payment !== 'authorized';
}

/**
 * Paid (or authorized) COOKED-food pay-after order — cooking / ready stages.
 * Non-cooked (flagged-location goods) pay-after orders are excluded: the store may
 * cancel those after payment and the client is refunded.
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

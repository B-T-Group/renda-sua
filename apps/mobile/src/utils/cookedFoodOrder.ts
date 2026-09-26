import type { Order } from '../types/agent';

export type CookedFoodOrderLike = Pick<
  Order,
  | 'is_cooked_food_pickup'
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
    is_cooked_food: (line as { is_cooked_food?: boolean | null }).is_cooked_food,
  }));
}

function isAsapPickupOrder(order: CookedFoodOrderLike): boolean {
  if (order.fulfillment_method !== 'pickup') return false;
  return (
    order.fulfillment_timing === 'asap' ||
    (order.delivery_time_windows?.length ?? 0) === 0
  );
}

/** Merchant confirm uses ready-in flow (ASAP cooked-food pickup only). */
export function shouldUseCookedFoodConfirmModal(order: CookedFoodOrderLike): boolean {
  if (!isAsapPickupOrder(order)) return false;
  if (order.is_cooked_food_pickup === true) return true;
  return everyLineIsCookedFood(lineCookedFlags(order));
}

export function isCookedFoodPickupFlow(order: CookedFoodOrderLike): boolean {
  return shouldUseCookedFoodConfirmModal(order);
}

export function isCookedFoodAwaitingClientPayment(
  order: CookedFoodOrderLike
): boolean {
  if (!isCookedFoodPickupFlow(order)) return false;
  if (order.pay_after_merchant_confirm !== true) return false;
  const payment = order.payment_status;
  return payment !== 'paid' && payment !== 'authorized';
}

export function isCookedFoodStartCookingPriority(
  order: CookedFoodOrderLike
): boolean {
  if (!isCookedFoodPickupFlow(order)) return false;
  const status = order.current_status ?? '';
  if (status === 'preparing') return true;
  if (status !== 'confirmed') return false;
  if (isCookedFoodAwaitingClientPayment(order)) return false;
  const payment = order.payment_status;
  return payment === 'paid' || payment === 'authorized';
}

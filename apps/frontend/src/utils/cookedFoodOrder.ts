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

export function isAsapPickupOrder(order: CookedFoodOrderLike): boolean {
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

import type { CheckoutPreflightResult } from '../hooks/useCheckoutPreflight';
import { isCookedFoodOrderSnapshot } from './cookedFoodOrder';

/** Unpaid pay-after goods are auto-cancelled this long after the store confirms (backend default). */
export const PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES = 45;

/** 'cooked' → kitchen wording; 'store' → generic store wording (flagged-location goods). */
export type PayAfterCopyVariant = 'cooked' | 'store';

/**
 * Every seller group is cooked food → keep the kitchen wording; any non-cooked group
 * (flagged-location goods) switches the whole checkout to generic "store" wording.
 */
export function payAfterCopyVariantForPreflight(
  preflight: Pick<CheckoutPreflightResult, 'groups'> | null | undefined
): PayAfterCopyVariant {
  const groups = preflight?.groups ?? [];
  if (groups.length > 0 && groups.every((g) => g.all_cooked_food === true)) {
    return 'cooked';
  }
  return 'store';
}

export function payAfterCopyVariantForOrder(order: {
  is_cooked_food_pickup?: boolean | null;
  pay_after_merchant_confirm?: boolean | null;
  order_items?: Array<{
    is_cooked_food?: boolean | null;
    item?: { is_cooked_food?: boolean | null } | null;
  }> | null;
}): PayAfterCopyVariant {
  return isCookedFoodOrderSnapshot(order) ? 'cooked' : 'store';
}

/**
 * The create response is authoritative: the location flag can flip between the
 * preflight and the create call, so never navigate on the stale preflight value.
 */
export function resolveCreatedPayAfter(
  orders: Array<{ pay_after_merchant_confirm?: boolean | null }>
): boolean {
  return orders.some((o) => o.pay_after_merchant_confirm === true);
}

/** ISO deadline by which the client must pay a pay-after goods order, or null. */
export function payAfterPayByDeadline(order: {
  current_status?: string | null;
  payment_status?: string | null;
  pay_after_merchant_confirm?: boolean | null;
  is_cooked_food_pickup?: boolean | null;
  order_items?: Array<{
    is_cooked_food?: boolean | null;
    item?: { is_cooked_food?: boolean | null } | null;
  }> | null;
  order_status_history?: Array<{ status?: string | null; created_at: string }> | null;
}): Date | null {
  if (order.pay_after_merchant_confirm !== true) return null;
  if (order.current_status !== 'confirmed') return null;
  if (order.payment_status === 'paid' || order.payment_status === 'authorized') {
    return null;
  }
  if (isCookedFoodOrderSnapshot(order)) return null;
  const confirmed = (order.order_status_history ?? [])
    .filter((h) => h.status === 'confirmed')
    .map((h) => new Date(h.created_at).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];
  if (confirmed == null) return null;
  return new Date(confirmed + PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES * 60_000);
}

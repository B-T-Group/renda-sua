import type { ResolvedCheckoutConfig } from '../types/checkout';
import { isCookedFoodOrderSnapshot, type CookedFoodOrderLike } from './cookedFoodOrder';

/** Unpaid pay-after goods are auto-cancelled this long after the store confirms (backend default). */
export const PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES = 45;

/** 'cooked' → kitchen wording; 'store' → generic store wording (flagged-location goods). */
export type PayAfterCopyVariant = 'cooked' | 'store';

/** Kitchen wording only when every seller group is all cooked food. */
export function payAfterCopyVariantForPreflight(
  preflight: Pick<ResolvedCheckoutConfig, 'groups'> | null | undefined
): PayAfterCopyVariant {
  const groups = preflight?.groups ?? [];
  if (groups.length > 0 && groups.every((g) => g.all_cooked_food === true)) return 'cooked';
  return 'store';
}

/**
 * The create response is authoritative: the location flag can flip between preflight and
 * create, so navigation must use the resolved flag from create, not the stale preflight.
 */
export function resolveCreatedPayAfter(
  orders: Array<{ pay_after_merchant_confirm?: boolean | null }>
): boolean {
  return orders.some((o) => o.pay_after_merchant_confirm === true);
}

/** Deadline by which the client must pay an unpaid pay-after goods order, or null. */
export function payAfterPayByDeadline(
  order: CookedFoodOrderLike & {
    order_status_history?: Array<{ status?: string | null; created_at: string }> | null;
  }
): Date | null {
  if (order.pay_after_merchant_confirm !== true) return null;
  if (order.current_status !== 'confirmed') return null;
  if (order.payment_status === 'paid' || order.payment_status === 'authorized') return null;
  if (isCookedFoodOrderSnapshot(order)) return null;
  const confirmed = (order.order_status_history ?? [])
    .filter((h) => h.status === 'confirmed')
    .map((h) => new Date(h.created_at).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];
  if (confirmed == null) return null;
  return new Date(confirmed + PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES * 60_000);
}

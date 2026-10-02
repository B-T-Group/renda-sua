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

/** True when `order` is a pay-after order the client has not paid yet (nothing was charged). */
export function isUnpaidPayAfterOrder(order: {
  pay_after_merchant_confirm?: boolean | null;
  payment_status?: string | null;
}): boolean {
  if (order.pay_after_merchant_confirm !== true) return false;
  const payment = (order.payment_status ?? '').toLowerCase();
  return payment !== 'paid' && payment !== 'authorized';
}

/** Minutes left (inclusive) at or under which the pay-by line switches to the warning colour. */
export const PAY_BY_URGENT_MINUTES = 10;

export type PayByUrgency = 'normal' | 'urgent' | 'expired';

export function payByUrgency(deadline: Date, now: Date = new Date()): PayByUrgency {
  const msLeft = deadline.getTime() - now.getTime();
  if (msLeft <= 0) return 'expired';
  return msLeft <= PAY_BY_URGENT_MINUTES * 60_000 ? 'urgent' : 'normal';
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Pay-by time in the APP language (not the device locale): 24h for French, 12h for English.
 * When the deadline falls on a different calendar day than `now`, `tomorrowLabel` is prefixed.
 */
export function formatPayByTime(
  deadline: Date,
  language: string | undefined,
  now: Date = new Date(),
  tomorrowLabel = 'tomorrow'
): string {
  const isFrench = (language ?? '').toLowerCase().startsWith('fr');
  const time = deadline.toLocaleTimeString(isFrench ? 'fr-FR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !isFrench,
  });
  return isSameLocalDay(deadline, now) ? time : `${tomorrowLabel} ${time}`;
}

/** Split translated text around the first `time` occurrence so the time can be rendered bold. */
export function splitAroundTime(
  text: string,
  time: string
): { before: string; time: string; after: string } | null {
  const index = text.indexOf(time);
  if (index < 0) return null;
  return {
    before: text.slice(0, index),
    time,
    after: text.slice(index + time.length),
  };
}

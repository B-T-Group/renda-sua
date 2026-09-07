/** Keep in sync with apps/backend/src/orders/order-refund-window.util.ts */
export const ORDER_REFUND_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function isOrderRefundRequestAllowed(
  completedAtIso: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (completedAtIso == null || completedAtIso === '') {
    return false;
  }
  const completedMs = new Date(completedAtIso).getTime();
  if (Number.isNaN(completedMs)) {
    return false;
  }
  return nowMs <= completedMs + ORDER_REFUND_WINDOW_MS;
}

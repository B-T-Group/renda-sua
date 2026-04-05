/**
 * Client refund policy: matches apps/backend/src/orders/order-refund-window.util.ts
 */
export const ORDER_REFUND_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function isOrderRefundRequestAllowed(
  completedAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (completedAt == null || completedAt === '') {
    return false;
  }
  const completedMs = new Date(completedAt).getTime();
  if (Number.isNaN(completedMs)) {
    return false;
  }
  const deadlineMs = completedMs + ORDER_REFUND_WINDOW_MS;
  return nowMs <= deadlineMs;
}

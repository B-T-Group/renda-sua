/**
 * Client refund policy: request allowed only while completion is within this window.
 * Keep in sync with apps/frontend/src/utils/orderRefundWindow.ts
 */
export const ORDER_REFUND_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * True when the order may receive a client refund request: completed_at is set and
 * now is still within ORDER_REFUND_WINDOW_MS after completion (inclusive of the window end).
 */
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
  const deadlineMs = completedMs + ORDER_REFUND_WINDOW_MS;
  return nowMs <= deadlineMs;
}

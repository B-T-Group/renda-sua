export const COMPLETED_ORDER_STATUSES = [
  'delivered',
  'complete',
  'completed',
] as const;

export const CANCELLED_ORDER_STATUSES = [
  'cancelled',
  'failed',
  'refunded',
] as const;

/**
 * Resolved refund pipeline statuses (not `refund_requested`, which still needs merchant action).
 * Valid Hasura `order_status` enum values only.
 */
export const RESOLVED_REFUND_ORDER_STATUSES = [
  'refund_approved_full',
  'refund_approved_partial',
  'refund_approved_replace',
  'refund_processing',
  'refund_rejected',
  'refund_failed',
] as const;

/**
 * Valid Hasura `order_status` values that remove a card from the Active Orders carousel.
 * Do not include aliases like `completed` — invalid enum values make `_nin` queries fail.
 */
export const TERMINAL_ORDER_STATUSES = [
  'delivered',
  'complete',
  'cancelled',
  'failed',
  'refunded',
  ...RESOLVED_REFUND_ORDER_STATUSES,
] as const;

export const isCompletedOrderStatus = (
  status: string | undefined | null
): boolean =>
  COMPLETED_ORDER_STATUSES.includes(
    status as (typeof COMPLETED_ORDER_STATUSES)[number]
  );

export const isCancelledOrderStatus = (
  status: string | undefined | null
): boolean =>
  CANCELLED_ORDER_STATUSES.includes(
    status as (typeof CANCELLED_ORDER_STATUSES)[number]
  );

export const isResolvedRefundOrderStatus = (
  status: string | undefined | null
): boolean =>
  RESOLVED_REFUND_ORDER_STATUSES.includes(
    status as (typeof RESOLVED_REFUND_ORDER_STATUSES)[number]
  );

export const isTerminalOrderStatus = (
  status: string | undefined | null
): boolean =>
  TERMINAL_ORDER_STATUSES.includes(
    status as (typeof TERMINAL_ORDER_STATUSES)[number]
  );

export function partitionOrdersByActivity<
  T extends { current_status?: string | null },
>(orders: T[]): { active: T[]; completed: T[]; cancelled: T[] } {
  const active: T[] = [];
  const completed: T[] = [];
  const cancelled: T[] = [];

  orders.forEach((order) => {
    const status = order.current_status || '';
    if (isCancelledOrderStatus(status) || isResolvedRefundOrderStatus(status)) {
      cancelled.push(order);
    } else if (isCompletedOrderStatus(status)) {
      completed.push(order);
    } else {
      active.push(order);
    }
  });

  return { active, completed, cancelled };
}

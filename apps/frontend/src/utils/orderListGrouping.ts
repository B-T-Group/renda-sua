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

export function partitionOrdersByActivity<
  T extends { current_status?: string | null },
>(orders: T[]): { active: T[]; completed: T[]; cancelled: T[] } {
  const active: T[] = [];
  const completed: T[] = [];
  const cancelled: T[] = [];

  orders.forEach((order) => {
    const status = order.current_status || '';
    if (isCancelledOrderStatus(status)) {
      cancelled.push(order);
    } else if (isCompletedOrderStatus(status)) {
      completed.push(order);
    } else {
      active.push(order);
    }
  });

  return { active, completed, cancelled };
}

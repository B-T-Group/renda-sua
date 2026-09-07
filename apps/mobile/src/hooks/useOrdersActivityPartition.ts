import { useMemo } from 'react';
import { partitionOrdersByActivity } from '../utils/orderListGrouping';

/** Partition helper for list screens that opt into activity grouping. */
export function useOrdersActivityPartition<
  T extends { current_status?: string | null },
>(orders: T[], enabled: boolean) {
  return useMemo(() => {
    if (!enabled) {
      return {
        active: orders,
        completed: [] as T[],
        cancelled: [] as T[],
        hasInactive: false,
      };
    }
    const parts = partitionOrdersByActivity(orders);
    return {
      ...parts,
      hasInactive: parts.completed.length > 0 || parts.cancelled.length > 0,
    };
  }, [enabled, orders]);
}

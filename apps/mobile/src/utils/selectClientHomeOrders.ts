import type { Order } from '../types/agent';
import { partitionOrdersByActivity } from './orderListGrouping';
import {
  orderToPhaseInput,
  resolveOrderPhase,
  type OrderPrimaryActionId,
} from './orderPhase';

export const CLIENT_HOME_ORDERS_CAP = 2;

const NEEDS_CLIENT_ACTIONS = new Set<OrderPrimaryActionId>([
  'pay',
  'send_pin',
  'confirm_receipt',
  'complete',
]);

const IN_MOTION_STATUSES = new Set([
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'shipped',
  'in_delivery',
]);

export type ClientHomeOrderRank = 0 | 1 | 2;

export interface SelectClientHomeOrdersResult {
  selected: Order[];
  totalActive: number;
}

/** Lower rank = higher priority on the home strip. */
export function clientHomeOrderRank(order: Order): ClientHomeOrderRank {
  const info = resolveOrderPhase(orderToPhaseInput(order), 'client');
  if (
    info.hubGroup === 'action_needed' ||
    NEEDS_CLIENT_ACTIONS.has(info.primaryActionId)
  ) {
    return 0;
  }
  const status = order.current_status || '';
  if (IN_MOTION_STATUSES.has(status)) return 1;
  return 2;
}

function orderRecencyMs(order: Order): number {
  const raw =
    (order as { updated_at?: string | null }).updated_at ||
    (order as { created_at?: string | null }).created_at ||
    '';
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Active client orders for browse home: needs-client first, then in-motion,
 * then waiting/preparing. Cap at `CLIENT_HOME_ORDERS_CAP`.
 */
export function selectClientHomeOrders(
  orders: Order[],
  cap: number = CLIENT_HOME_ORDERS_CAP
): SelectClientHomeOrdersResult {
  const { active } = partitionOrdersByActivity(orders);
  const sorted = [...active].sort((a, b) => {
    const rankDiff = clientHomeOrderRank(a) - clientHomeOrderRank(b);
    if (rankDiff !== 0) return rankDiff;
    return orderRecencyMs(b) - orderRecencyMs(a);
  });
  return {
    selected: sorted.slice(0, Math.max(0, cap)),
    totalActive: active.length,
  };
}

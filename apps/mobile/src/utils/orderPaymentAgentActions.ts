import type { Order } from '../types/agent';

/**
 * Same branch as web `AgentActions.getAvailableActions` for `out_for_delivery`
 * (apps/frontend/src/components/orders/AgentActions.tsx).
 */
export function orderNeedsPayAtDeliveryAgentActions(order: Pick<Order, 'payment_timing' | 'payment_method'>): boolean {
  return order.payment_timing === 'pay_at_delivery' || order.payment_method === 'pay_on_delivery';
}

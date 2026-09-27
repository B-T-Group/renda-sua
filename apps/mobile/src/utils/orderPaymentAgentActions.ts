import type { Order } from '../types/agent';

/**
 * Same branch as web `AgentActions.getAvailableActions` for `out_for_delivery`
 * (apps/frontend/src/components/orders/AgentActions.tsx).
 *
 * Cooked-food MoMo pay-after is collected before delivery (not classic PAD),
 * even if older rows still have payment_timing=pay_at_delivery.
 */
export function orderNeedsPayAtDeliveryAgentActions(
  order: Pick<
    Order,
    'payment_timing' | 'payment_method' | 'pay_after_merchant_confirm'
  >
): boolean {
  if (order.pay_after_merchant_confirm === true) return false;
  return (
    order.payment_timing === 'pay_at_delivery' ||
    order.payment_method === 'pay_on_delivery'
  );
}

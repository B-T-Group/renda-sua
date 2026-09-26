/**
 * Same branch as mobile `orderNeedsPayAtDeliveryAgentActions` and
 * `AgentActions.getAvailableActions` for `out_for_delivery`.
 *
 * Cooked-food MoMo pay-after is collected before delivery (not classic PAD),
 * even if older rows still have payment_timing=pay_at_delivery.
 */
export function orderNeedsPayAtDeliveryAgentActions(order: {
  payment_timing?: string | null;
  payment_method?: string | null;
  pay_after_merchant_confirm?: boolean | null;
}): boolean {
  if (order.pay_after_merchant_confirm === true) return false;
  return (
    order.payment_timing === 'pay_at_delivery' ||
    order.payment_method === 'pay_on_delivery'
  );
}

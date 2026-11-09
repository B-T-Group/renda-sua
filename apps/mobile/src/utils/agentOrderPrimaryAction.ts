import { isCarrierShipping } from './fulfillmentMethod';
import { orderNeedsPayAtDeliveryAgentActions } from './orderPaymentAgentActions';

/** What the agent Home and Orders primary button does for one order. */
export type AgentOrderPrimaryAction =
  | 'pickUp'
  | 'startTransit'
  | 'outForDelivery'
  | 'requestPayment'
  | 'completeDelivery'
  | 'openDetail';

type AgentOrderActionInput = {
  fulfillment_method?: string | null;
  current_status?: string | null;
  payment_timing?: string | null;
  payment_method?: string | null;
  pay_after_merchant_confirm?: boolean | null;
};

/**
 * Home opens the order for shipping and unknown statuses.
 * The orders list treats `openDetail` as "no inline action".
 */
export function resolveAgentOrderPrimaryAction(
  order: AgentOrderActionInput,
  options: { markInTransit: boolean }
): AgentOrderPrimaryAction {
  if (isCarrierShipping(order.fulfillment_method)) return 'openDetail';
  switch (order.current_status) {
    case 'assigned_to_agent':
      return 'pickUp';
    case 'picked_up':
      return options.markInTransit ? 'startTransit' : 'outForDelivery';
    case 'in_transit':
      return 'outForDelivery';
    case 'out_for_delivery':
      return orderNeedsPayAtDeliveryAgentActions(order)
        ? 'requestPayment'
        : 'completeDelivery';
    default:
      return 'openDetail';
  }
}

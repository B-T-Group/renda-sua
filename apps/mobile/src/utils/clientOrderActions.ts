import type { Order } from '../types/agent';
import { isStorePickupOrder } from './businessOrderListDisplay';
import { isCarrierShipping } from './fulfillmentMethod';

const AGENT_TRACK_STATUSES = ['picked_up', 'in_transit', 'out_for_delivery'];
const PIN_STATUSES = ['picked_up', 'in_transit', 'out_for_delivery'];

export function clientShowAgentLocation(status: string | undefined, fulfillmentMethod?: string | null): boolean {
  if (isCarrierShipping(fulfillmentMethod)) return false;
  return !!status && AGENT_TRACK_STATUSES.includes(status);
}

/** Show from pickup onward so clients can prep/send the PIN before arrival. */
export function clientShowDeliveryPin(order: Order): boolean {
  if (isCarrierShipping(order.fulfillment_method)) return false;
  if (order.payment_timing === 'pay_at_delivery') return false;
  if (order.payment_method === 'pay_on_delivery') return false;
  if (order.payment_timing === 'pay_at_pickup') return false;

  if (isStorePickupOrder(order)) {
    const status = order.current_status || '';
    if (status !== 'ready_for_pickup') return false;
    const payment = order.payment_status;
    return payment === 'authorized' || payment === 'paid';
  }

  const status = order.current_status || '';
  return PIN_STATUSES.includes(status);
}

/** Client may cancel before an agent is assigned (backend rule). */
export function clientCanCancelOrder(order: Order): boolean {
  if (order.assigned_agent_id) return false;
  const s = order.current_status || '';
  if (isCarrierShipping(order.fulfillment_method)) {
    return ['pending_payment', 'pending', 'confirmed', 'preparing', 'awaiting_shipment'].includes(s);
  }
  return ['pending_payment', 'pending', 'confirmed', 'preparing', 'ready_for_pickup'].includes(s);
}

export function clientCanConfirmReceipt(order: Order): boolean {
  if (!isCarrierShipping(order.fulfillment_method)) return false;
  const s = order.current_status || '';
  return s === 'shipped' || s === 'in_delivery';
}

/**
 * Dispatch escalated through both radius rounds without a claim. Offer the
 * client a fallback (switch to pickup or cancel) instead of leaving them stuck.
 */
export function clientShowNoAgentOptions(order: Order): boolean {
  if (isCarrierShipping(order.fulfillment_method)) return false;
  if (!order.dispatch_exhausted_at) return false;
  if (order.assigned_agent_id) return false;
  if (isStorePickupOrder(order)) return false;
  return order.current_status === 'ready_for_pickup';
}


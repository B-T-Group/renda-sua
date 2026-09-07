import type { Order } from '../types/agent';
import { isStorePickupOrder } from './businessOrderListDisplay';
import { isCarrierShipping } from './fulfillmentMethod';

export type JourneyTone = 'info' | 'success' | 'warning' | 'error';

export type JourneyIllustrationId =
  | 'received'
  | 'preparing'
  | 'pickupReady'
  | 'courier'
  | 'pin'
  | 'delivered'
  | 'cancelled';

export interface ClientOrderJourney {
  stageId: string;
  titleKey: string;
  titleDefault: string;
  nowKey: string;
  nowDefault: string;
  nextKey: string | null;
  nextDefault: string | null;
  tone: JourneyTone;
  illustrationId: JourneyIllustrationId;
  agentFirstName: string | null;
  showPinHint: boolean;
  emphasizePinCta: boolean;
  interpolation: Record<string, string>;
}

function isPickup(order: Order): boolean {
  return isStorePickupOrder(order);
}

function agentFirstName(order: Order): string | null {
  const name = order.assigned_agent?.user?.first_name?.trim();
  return name || null;
}

function stage(
  partial: Omit<ClientOrderJourney, 'interpolation'> & {
    interpolation?: Record<string, string>;
  }
): ClientOrderJourney {
  return {
    ...partial,
    interpolation: partial.interpolation ?? {},
  };
}

function pendingPaymentStage(): ClientOrderJourney {
  return stage({
    stageId: 'pending_payment',
    titleKey: 'client.orderJourney.pendingPayment.title',
    titleDefault: 'Payment needed',
    nowKey: 'client.orderJourney.pendingPayment.now',
    nowDefault: 'Finish payment so the store can confirm your order.',
    nextKey: 'client.orderJourney.pendingPayment.next',
    nextDefault: 'Once paid, the business will confirm and prepare your order.',
    tone: 'warning',
    illustrationId: 'received',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function pendingStage(): ClientOrderJourney {
  return stage({
    stageId: 'pending',
    titleKey: 'client.orderJourney.pending.title',
    titleDefault: 'Order received',
    nowKey: 'client.orderJourney.pending.now',
    nowDefault: 'The business has received your order.',
    nextKey: 'client.orderJourney.pending.next',
    nextDefault:
      'It will be confirmed shortly and prepared. When ready, it will be offered to delivery agents.',
    tone: 'info',
    illustrationId: 'received',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function pendingPickupStage(): ClientOrderJourney {
  return stage({
    stageId: 'pending_pickup',
    titleKey: 'client.orderJourney.pendingPickup.title',
    titleDefault: 'Order received',
    nowKey: 'client.orderJourney.pendingPickup.now',
    nowDefault: 'The business has received your order.',
    nextKey: 'client.orderJourney.pendingPickup.next',
    nextDefault: 'It will be confirmed shortly and prepared for store pickup.',
    tone: 'info',
    illustrationId: 'received',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function confirmedStage(): ClientOrderJourney {
  return stage({
    stageId: 'confirmed',
    titleKey: 'client.orderJourney.confirmed.title',
    titleDefault: 'Order confirmed',
    nowKey: 'client.orderJourney.confirmed.now',
    nowDefault: 'The business confirmed your order.',
    nextKey: 'client.orderJourney.confirmed.next',
    nextDefault: 'They will prepare it next.',
    tone: 'success',
    illustrationId: 'preparing',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function preparingStage(pickup: boolean): ClientOrderJourney {
  return stage({
    stageId: 'preparing',
    titleKey: 'client.orderJourney.preparing.title',
    titleDefault: 'Being prepared',
    nowKey: 'client.orderJourney.preparing.now',
    nowDefault: 'Your order is being prepared carefully.',
    nextKey: pickup
      ? 'client.orderJourney.preparing.nextPickup'
      : 'client.orderJourney.preparing.nextDelivery',
    nextDefault: pickup
      ? 'When ready, you can collect it at the store.'
      : 'When ready, it will be offered to delivery agents.',
    tone: 'info',
    illustrationId: 'preparing',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function readyDeliveryWaiting(): ClientOrderJourney {
  return stage({
    stageId: 'ready_waiting_agent',
    titleKey: 'client.orderJourney.readyWaiting.title',
    titleDefault: 'Ready for delivery',
    nowKey: 'client.orderJourney.readyWaiting.now',
    nowDefault: 'Your order is ready and waiting for a delivery agent.',
    nextKey: 'client.orderJourney.readyWaiting.next',
    nextDefault: 'An agent will claim it and pick it up from the store.',
    tone: 'info',
    illustrationId: 'courier',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function pickupReadyNextCopy(
  pinEligible: boolean,
  payAtPickup: boolean
): { key: string; defaultValue: string } {
  if (payAtPickup) {
    return {
      key: 'client.orderJourney.readyPickup.nextPayAtPickup',
      defaultValue:
        'When you arrive, tap Pay and approve the mobile money request on your phone. The store will see the payment, then you can collect your order.',
    };
  }
  if (pinEligible) {
    return {
      key: 'client.orderJourney.readyPickup.nextPin',
      defaultValue:
        'Head to the store and send your pickup PIN so the seller can confirm.',
    };
  }
  return {
    key: 'client.orderJourney.readyPickup.next',
    defaultValue: 'Head to the store to collect it.',
  };
}

function readyPickupStage(
  pinEligible: boolean,
  payAtPickup: boolean
): ClientOrderJourney {
  const next = pickupReadyNextCopy(pinEligible, payAtPickup);
  return stage({
    stageId: 'ready_pickup',
    titleKey: 'client.orderJourney.readyPickup.title',
    titleDefault: 'Ready for pickup',
    nowKey: 'client.orderJourney.readyPickup.now',
    nowDefault: 'Your order is ready at the store.',
    nextKey: next.key,
    nextDefault: next.defaultValue,
    tone: 'success',
    illustrationId: 'pickupReady',
    agentFirstName: null,
    showPinHint: pinEligible,
    emphasizePinCta: pinEligible,
  });
}

function claimedStage(name: string | null): ClientOrderJourney {
  const hasName = !!name;
  return stage({
    stageId: 'claimed',
    titleKey: 'client.orderJourney.claimed.title',
    titleDefault: 'Agent on the way to the store',
    nowKey: hasName
      ? 'client.orderJourney.claimed.nowNamed'
      : 'client.orderJourney.claimed.now',
    nowDefault: hasName
      ? '{{agentName}} just claimed your order and is heading to pick it up.'
      : 'A delivery agent claimed your order and is heading to pick it up.',
    nextKey: 'client.orderJourney.claimed.next',
    nextDefault: 'After pickup, they will bring it to you.',
    tone: 'success',
    illustrationId: 'courier',
    agentFirstName: name,
    showPinHint: false,
    emphasizePinCta: false,
    interpolation: name ? { agentName: name } : {},
  });
}

function onTheWayStage(
  name: string | null,
  pinEligible: boolean
): ClientOrderJourney {
  const hasName = !!name;
  return stage({
    stageId: 'on_the_way',
    titleKey: 'client.orderJourney.onTheWay.title',
    titleDefault: 'On the way to you',
    nowKey: hasName
      ? 'client.orderJourney.onTheWay.nowNamed'
      : 'client.orderJourney.onTheWay.now',
    nowDefault: hasName
      ? '{{agentName}} picked up your order and is coming to you.'
      : 'Your delivery person picked up your order and is coming to you.',
    nextKey: pinEligible
      ? 'client.orderJourney.onTheWay.next'
      : 'client.orderJourney.onTheWay.nextPayAtDelivery',
    nextDefault: pinEligible
      ? 'When they arrive, send them the delivery PIN from this app so they can complete the delivery and get paid.'
      : 'When they arrive, they will send a payment request. Keep your phone ready to approve it.',
    tone: 'info',
    illustrationId: 'courier',
    agentFirstName: name,
    showPinHint: pinEligible,
    emphasizePinCta: false,
    interpolation: name ? { agentName: name } : {},
  });
}

function outForDeliveryStage(
  name: string | null,
  pinEligible: boolean
): ClientOrderJourney {
  const hasName = !!name;
  return stage({
    stageId: 'out_for_delivery',
    titleKey: 'client.orderJourney.outForDelivery.title',
    titleDefault: 'Almost there',
    nowKey: hasName
      ? 'client.orderJourney.outForDelivery.nowNamed'
      : 'client.orderJourney.outForDelivery.now',
    nowDefault: hasName
      ? '{{agentName}} is out for delivery and will arrive soon.'
      : 'Your order is out for delivery and will arrive soon.',
    nextKey: pinEligible
      ? 'client.orderJourney.outForDelivery.next'
      : 'client.orderJourney.outForDelivery.nextPayAtDelivery',
    nextDefault: pinEligible
      ? 'Be available at your address. When they arrive, send the delivery PIN from this app so they can complete the order and get paid.'
      : 'Be available at your address. The agent will send a payment request; approve it on your phone.',
    tone: 'warning',
    illustrationId: pinEligible ? 'pin' : 'courier',
    agentFirstName: name,
    showPinHint: pinEligible,
    emphasizePinCta: pinEligible,
    interpolation: name ? { agentName: name } : {},
  });
}

function deliveredStage(): ClientOrderJourney {
  return stage({
    stageId: 'delivered',
    titleKey: 'client.orderJourney.delivered.title',
    titleDefault: 'Delivered',
    nowKey: 'client.orderJourney.delivered.now',
    nowDefault: 'Your order has been delivered.',
    nextKey: 'client.orderJourney.delivered.next',
    nextDefault: 'You can mark it complete and leave a rating when ready.',
    tone: 'success',
    illustrationId: 'delivered',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function completeStage(): ClientOrderJourney {
  return stage({
    stageId: 'complete',
    titleKey: 'client.orderJourney.complete.title',
    titleDefault: 'Order complete',
    nowKey: 'client.orderJourney.complete.now',
    nowDefault: 'This order is finished. Thank you!',
    nextKey: null,
    nextDefault: null,
    tone: 'success',
    illustrationId: 'delivered',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function cancelledStage(failed: boolean): ClientOrderJourney {
  return stage({
    stageId: failed ? 'failed' : 'cancelled',
    titleKey: failed
      ? 'client.orderJourney.failed.title'
      : 'client.orderJourney.cancelled.title',
    titleDefault: failed ? 'Delivery failed' : 'Order cancelled',
    nowKey: failed
      ? 'client.orderJourney.failed.now'
      : 'client.orderJourney.cancelled.now',
    nowDefault: failed
      ? 'This delivery could not be completed.'
      : 'This order was cancelled.',
    nextKey: null,
    nextDefault: null,
    tone: 'error',
    illustrationId: 'cancelled',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function refundStage(status: string): ClientOrderJourney {
  if (status === 'refunded') {
    return stage({
      stageId: 'refunded',
      titleKey: 'client.orderJourney.refunded.title',
      titleDefault: 'Refunded',
      nowKey: 'client.orderJourney.refunded.now',
      nowDefault: 'Your refund has been processed.',
      nextKey: 'client.orderJourney.refunded.next',
      nextDefault: 'Funds appear in your Rendasua wallet. You can withdraw from Accounts.',
      tone: 'info',
      illustrationId: 'delivered',
      agentFirstName: null,
      showPinHint: false,
      emphasizePinCta: false,
    });
  }
  if (status === 'refund_rejected') {
    return stage({
      stageId: 'refund_rejected',
      titleKey: 'client.orderJourney.refundRejected.title',
      titleDefault: 'Refund request declined',
      nowKey: 'client.orderJourney.refundRejected.now',
      nowDefault: 'Your refund request was not approved.',
      nextKey: 'client.orderJourney.refundRejected.next',
      nextDefault: 'Contact support if you need more help.',
      tone: 'warning',
      illustrationId: 'cancelled',
      agentFirstName: null,
      showPinHint: false,
      emphasizePinCta: false,
    });
  }
  if (status === 'refund_failed') {
    return stage({
      stageId: 'refund_failed',
      titleKey: 'client.orderJourney.refundFailed.title',
      titleDefault: 'Refund issue',
      nowKey: 'client.orderJourney.refundFailed.now',
      nowDefault: 'We could not finish processing your refund.',
      nextKey: 'client.orderJourney.refundFailed.next',
      nextDefault: 'Our team is looking into it. Contact support if this persists.',
      tone: 'error',
      illustrationId: 'cancelled',
      agentFirstName: null,
      showPinHint: false,
      emphasizePinCta: false,
    });
  }
  return stage({
    stageId: 'refund_in_progress',
    titleKey: 'client.orderJourney.refundInProgress.title',
    titleDefault: 'Refund in progress',
    nowKey: 'client.orderJourney.refundInProgress.now',
    nowDefault: 'Your refund request is being processed.',
    nextKey: 'client.orderJourney.refundInProgress.next',
    nextDefault: 'We will update you when it is complete.',
    tone: 'info',
    illustrationId: 'received',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function fallbackStage(): ClientOrderJourney {
  return stage({
    stageId: 'unknown',
    titleKey: 'client.orderJourney.unknown.title',
    titleDefault: 'Order update',
    nowKey: 'client.orderJourney.unknown.now',
    nowDefault: 'We are updating the status of your order.',
    nextKey: 'client.orderJourney.unknown.next',
    nextDefault: 'Check back shortly for the next step.',
    tone: 'info',
    illustrationId: 'received',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function shippingPendingStage(): ClientOrderJourney {
  return stage({
    stageId: 'shipping_pending',
    titleKey: 'client.orderJourney.shippingPending.title',
    titleDefault: 'Order received',
    nowKey: 'client.orderJourney.shippingPending.now',
    nowDefault: 'The seller has received your order.',
    nextKey: 'client.orderJourney.shippingPending.next',
    nextDefault: 'They will confirm, then ship it with a carrier.',
    tone: 'info',
    illustrationId: 'received',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function shippingPreparingStage(): ClientOrderJourney {
  return stage({
    stageId: 'shipping_preparing',
    titleKey: 'client.orderJourney.shippingPreparing.title',
    titleDefault: 'Preparing shipment',
    nowKey: 'client.orderJourney.shippingPreparing.now',
    nowDefault: 'The seller is packing your order.',
    nextKey: 'client.orderJourney.shippingPreparing.next',
    nextDefault: 'You will get tracking details once it ships.',
    tone: 'info',
    illustrationId: 'preparing',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function shippingInTransitStage(): ClientOrderJourney {
  return stage({
    stageId: 'shipping_in_transit',
    titleKey: 'client.orderJourney.shippingInTransit.title',
    titleDefault: 'On the way',
    nowKey: 'client.orderJourney.shippingInTransit.now',
    nowDefault: 'Your order was shipped with a carrier.',
    nextKey: 'client.orderJourney.shippingInTransit.next',
    nextDefault: 'Confirm when the package arrives.',
    tone: 'info',
    illustrationId: 'courier',
    agentFirstName: null,
    showPinHint: false,
    emphasizePinCta: false,
  });
}

function shippingJourney(status: string): ClientOrderJourney {
  if (status === 'pending_payment') return pendingPaymentStage();
  if (status === 'pending') return shippingPendingStage();
  if (status === 'confirmed' || status === 'preparing' || status === 'awaiting_shipment') {
    return shippingPreparingStage();
  }
  if (status === 'shipped' || status === 'in_delivery') return shippingInTransitStage();
  if (status === 'complete') return completeStage();
  if (status === 'cancelled') return cancelledStage(false);
  if (status === 'failed') return cancelledStage(true);
  return fallbackStage();
}

function isPinEligible(order: Order): boolean {
  if (order.payment_timing === 'pay_at_delivery') return false;
  if (order.payment_timing === 'pay_at_pickup') return false;
  if (order.payment_method === 'pay_on_delivery') return false;
  return true;
}

function isPickupPinReady(order: Order): boolean {
  if (!isPinEligible(order)) return false;
  const payment = order.payment_status;
  return payment === 'authorized' || payment === 'paid';
}

function isRefundStatus(status: string): boolean {
  return (
    status === 'refunded' ||
    status === 'refund_requested' ||
    status === 'refund_approved_full' ||
    status === 'refund_approved_partial' ||
    status === 'refund_approved_replace' ||
    status === 'refund_processing' ||
    status === 'refund_rejected' ||
    status === 'refund_failed'
  );
}

/** Maps an order to the client-facing journey stage shown on list/detail. */
export function getClientOrderJourney(order: Order): ClientOrderJourney {
  const status = order.current_status || '';
  const pickup = isPickup(order);
  const name = agentFirstName(order);
  const hasAgent = !!(order.assigned_agent_id || name);
  const pinEligible = isPinEligible(order);
  const pickupPinReady = isPickupPinReady(order);

  if (isRefundStatus(status)) {
    return refundStage(status);
  }
  if (isCarrierShipping(order.fulfillment_method)) {
    return shippingJourney(status);
  }

  switch (status) {
    case 'pending_payment':
      return pendingPaymentStage();
    case 'pending':
      return pickup ? pendingPickupStage() : pendingStage();
    case 'confirmed':
      return confirmedStage();
    case 'preparing':
      return preparingStage(pickup);
    case 'ready_for_pickup':
      if (pickup) {
        return readyPickupStage(
          pickupPinReady,
          order.payment_timing === 'pay_at_pickup'
        );
      }
      if (hasAgent) return claimedStage(name);
      return readyDeliveryWaiting();
    case 'assigned_to_agent':
      return claimedStage(name);
    case 'picked_up':
    case 'in_transit':
      return onTheWayStage(name, pinEligible);
    case 'out_for_delivery':
      return outForDeliveryStage(name, pinEligible);
    case 'delivered':
      return deliveredStage();
    case 'complete':
      return completeStage();
    case 'cancelled':
      return cancelledStage(false);
    case 'failed':
      return cancelledStage(true);
    default:
      return fallbackStage();
  }
}

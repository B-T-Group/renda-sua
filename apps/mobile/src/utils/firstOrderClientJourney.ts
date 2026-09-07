import { isFirstOrderGuidanceForced } from '../config/firstOrderDebug';
import type { JourneyIllustrationId } from './clientOrderJourney';
import {
  getFirstOrderFulfillmentPath,
  isFirstOrderCountEligible,
  isFirstOrderSuccessStatus,
  isFirstOrderTerminalStatus,
  type FirstOrderFulfillmentPath,
  type FirstOrderJourneyOrder,
} from './firstOrderJourney';

export type ClientFirstOrderOrder = FirstOrderJourneyOrder & {
  payment_method?: string | null;
  created_at?: string | null;
};

export type ClientFirstOrderStepId =
  | 'pending_payment'
  | 'order_received'
  | 'confirmed'
  | 'preparing'
  | 'courier_assigned'
  | 'on_the_way'
  | 'delivered'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'shipped'
  | 'received'
  | 'cancelled';

export type ClientFirstOrderStepState = 'done' | 'current' | 'upcoming';

export interface ClientFirstOrderStep {
  id: ClientFirstOrderStepId;
  titleKey: string;
  titleDefault: string;
  whatHappensKey: string;
  whatHappensDefault: string;
  illustrationId: JourneyIllustrationId;
  state: ClientFirstOrderStepState;
}

export interface ClientFirstOrderJourneyView {
  showJourney: boolean;
  isDebugForced: boolean;
  steps: ClientFirstOrderStep[];
  currentStepId: ClientFirstOrderStepId;
  isTerminal: boolean;
  isSuccess: boolean;
  fulfillmentPath: FirstOrderFulfillmentPath;
  pinExplainerKey: string | null;
  pinExplainerDefault: string | null;
}

interface StepTemplate {
  id: ClientFirstOrderStepId;
  titleKey: string;
  titleDefault: string;
  whatHappensKey: string;
  whatHappensDefault: string;
  illustrationId: JourneyIllustrationId;
}

const PENDING_PAYMENT: StepTemplate = {
  id: 'pending_payment',
  titleKey: 'client.firstOrder.steps.pendingPayment.title',
  titleDefault: 'Payment needed',
  whatHappensKey: 'client.firstOrder.steps.pendingPayment.whatHappens',
  whatHappensDefault:
    'Finish payment so the store can receive and confirm your order.',
  illustrationId: 'received',
};

const RECEIVED: StepTemplate = {
  id: 'order_received',
  titleKey: 'client.firstOrder.steps.orderReceived.title',
  titleDefault: 'Order received',
  whatHappensKey: 'client.firstOrder.steps.orderReceived.whatHappens',
  whatHappensDefault: 'The store has your order and will confirm it shortly.',
  illustrationId: 'received',
};

const CONFIRMED: StepTemplate = {
  id: 'confirmed',
  titleKey: 'client.firstOrder.steps.confirmed.title',
  titleDefault: 'Confirmed',
  whatHappensKey: 'client.firstOrder.steps.confirmed.whatHappens',
  whatHappensDefault: 'The store accepted your order and will start preparing it.',
  illustrationId: 'preparing',
};

const PREPARING_DELIVERY: StepTemplate = {
  id: 'preparing',
  titleKey: 'client.firstOrder.steps.preparing.title',
  titleDefault: 'Being prepared',
  whatHappensKey: 'client.firstOrder.steps.preparing.whatHappensDelivery',
  whatHappensDefault: 'The store is packing your items. Next, a courier will pick them up.',
  illustrationId: 'preparing',
};

const PREPARING_PICKUP: StepTemplate = {
  id: 'preparing',
  titleKey: 'client.firstOrder.steps.preparing.title',
  titleDefault: 'Being prepared',
  whatHappensKey: 'client.firstOrder.steps.preparing.whatHappensPickup',
  whatHappensDefault: 'The store is packing your items for pickup.',
  illustrationId: 'preparing',
};

const PREPARING_SHIPPING: StepTemplate = {
  id: 'preparing',
  titleKey: 'client.firstOrder.steps.preparing.title',
  titleDefault: 'Being prepared',
  whatHappensKey: 'client.firstOrder.steps.preparing.whatHappensShipping',
  whatHappensDefault: 'The seller is packing your order to ship with a carrier.',
  illustrationId: 'preparing',
};

const COURIER: StepTemplate = {
  id: 'courier_assigned',
  titleKey: 'client.firstOrder.steps.courierAssigned.title',
  titleDefault: 'A courier is assigned',
  whatHappensKey: 'client.firstOrder.steps.courierAssigned.whatHappens',
  whatHappensDefault: 'A delivery agent picks up your order from the store.',
  illustrationId: 'courier',
};

const ON_THE_WAY: StepTemplate = {
  id: 'on_the_way',
  titleKey: 'client.firstOrder.steps.onTheWay.title',
  titleDefault: 'On the way to you',
  whatHappensKey: 'client.firstOrder.steps.onTheWay.whatHappens',
  whatHappensDefault: 'Your courier is bringing the order to your address.',
  illustrationId: 'pin',
};

const DELIVERED: StepTemplate = {
  id: 'delivered',
  titleKey: 'client.firstOrder.steps.delivered.title',
  titleDefault: 'Delivered',
  whatHappensKey: 'client.firstOrder.steps.delivered.whatHappens',
  whatHappensDefault: 'Your first order is complete. You can leave a rating.',
  illustrationId: 'delivered',
};

const READY_PICKUP: StepTemplate = {
  id: 'ready_for_pickup',
  titleKey: 'client.firstOrder.steps.readyForPickup.title',
  titleDefault: 'Ready at the store',
  whatHappensKey: 'client.firstOrder.steps.readyForPickup.whatHappens',
  whatHappensDefault: 'Head to the store and share your pickup PIN when you arrive.',
  illustrationId: 'pickupReady',
};

const READY_PICKUP_PAY_AT_PICKUP: StepTemplate = {
  ...READY_PICKUP,
  whatHappensKey: 'client.firstOrder.steps.readyForPickup.whatHappensPayAtPickup',
  whatHappensDefault:
    'When you arrive, tap Pay and approve the mobile money request on your phone. The store will see the payment, then you can collect your order.',
};

const PICKED_UP: StepTemplate = {
  id: 'picked_up',
  titleKey: 'client.firstOrder.steps.pickedUp.title',
  titleDefault: 'Picked up',
  whatHappensKey: 'client.firstOrder.steps.pickedUp.whatHappens',
  whatHappensDefault: 'You collected your first order. You can leave a rating.',
  illustrationId: 'delivered',
};

const SHIPPED: StepTemplate = {
  id: 'shipped',
  titleKey: 'client.firstOrder.steps.shipped.title',
  titleDefault: 'Shipped',
  whatHappensKey: 'client.firstOrder.steps.shipped.whatHappens',
  whatHappensDefault: 'Your package is with the carrier. Confirm when it arrives.',
  illustrationId: 'courier',
};

const RECEIVED_SHIP: StepTemplate = {
  id: 'received',
  titleKey: 'client.firstOrder.steps.received.title',
  titleDefault: 'Received',
  whatHappensKey: 'client.firstOrder.steps.received.whatHappens',
  whatHappensDefault: 'Your first shipped order is complete. You can leave a rating.',
  illustrationId: 'delivered',
};

const CANCELLED: StepTemplate = {
  id: 'cancelled',
  titleKey: 'client.firstOrder.steps.cancelled.title',
  titleDefault: 'Order ended',
  whatHappensKey: 'client.firstOrder.steps.cancelled.whatHappens',
  whatHappensDefault: 'This order was cancelled or could not be completed.',
  illustrationId: 'cancelled',
};

const PIN_DELIVERY_KEY = 'client.firstOrder.pinExplainerDelivery';
const PIN_DELIVERY_DEFAULT =
  'Your delivery PIN is required. The courier is paid only when you share it — that confirms you received the order.';
const PIN_PICKUP_KEY = 'client.firstOrder.pinExplainerPickup';
const PIN_PICKUP_DEFAULT =
  'Your pickup PIN is required. The merchant is paid only when you share it — that confirms you collected your order.';

const FIRST_ORDER_WAVE_MS = 15 * 60 * 1000;

/** True when the client's active orders all belong to one checkout wave. */
export function isClientFirstOrderWaveEligible(
  orders: Array<{ created_at?: string | null; current_status?: string | null }>
): boolean {
  const active = orders.filter((o) => (o.current_status ?? '') !== 'cancelled');
  const pool = active.length > 0 ? active : orders;
  if (pool.length === 0) return false;
  const times = pool.map((o) => Date.parse(o.created_at ?? ''));
  if (times.some((t) => Number.isNaN(t))) {
    return isFirstOrderCountEligible(pool.length);
  }
  const oldest = Math.min(...times);
  return times.every((t) => t - oldest <= FIRST_ORDER_WAVE_MS);
}

/** True when this checkout batch is the client's first purchase (multi-cart safe). */
export function isClientFirstOrderCheckoutEligible(
  ordersTotal: number,
  justPlacedCount: number
): boolean {
  if (justPlacedCount < 1) return isFirstOrderCountEligible(ordersTotal);
  return ordersTotal <= justPlacedCount;
}

function templatesForPath(
  path: FirstOrderFulfillmentPath,
  includePendingPayment: boolean,
  payAtPickup = false
): StepTemplate[] {
  const readyPickup = payAtPickup ? READY_PICKUP_PAY_AT_PICKUP : READY_PICKUP;
  const base =
    path === 'pickup'
      ? [RECEIVED, CONFIRMED, PREPARING_PICKUP, readyPickup, PICKED_UP]
      : path === 'shipping'
        ? [RECEIVED, CONFIRMED, PREPARING_SHIPPING, SHIPPED, RECEIVED_SHIP]
        : [RECEIVED, CONFIRMED, PREPARING_DELIVERY, COURIER, ON_THE_WAY, DELIVERED];
  return includePendingPayment ? [PENDING_PAYMENT, ...base] : base;
}

function isPinEligible(order: ClientFirstOrderOrder): boolean {
  if (order.payment_timing === 'pay_at_delivery') return false;
  if (order.payment_timing === 'pay_at_pickup') return false;
  if (order.payment_method === 'pay_on_delivery') return false;
  return true;
}

function resolveDeliveryStep(order: FirstOrderJourneyOrder): ClientFirstOrderStepId {
  const status = order.current_status ?? '';
  if (status === 'pending_payment') return 'pending_payment';
  if (status === 'pending') return 'order_received';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'preparing') return 'preparing';
  if (status === 'ready_for_pickup' || status === 'assigned_to_agent') {
    return 'courier_assigned';
  }
  if (status === 'picked_up' || status === 'in_transit' || status === 'out_for_delivery') {
    return 'on_the_way';
  }
  return 'order_received';
}

function resolvePickupStep(status: string): ClientFirstOrderStepId {
  if (status === 'pending_payment') return 'pending_payment';
  if (status === 'pending') return 'order_received';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'preparing') return 'preparing';
  if (status === 'ready_for_pickup') return 'ready_for_pickup';
  return 'order_received';
}

function resolveShippingStep(status: string): ClientFirstOrderStepId {
  if (status === 'pending_payment') return 'pending_payment';
  if (status === 'pending') return 'order_received';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'preparing' || status === 'awaiting_shipment') return 'preparing';
  if (status === 'shipped' || status === 'in_delivery') return 'shipped';
  return 'order_received';
}

export function resolveClientFirstOrderStepId(
  order: FirstOrderJourneyOrder,
  path: FirstOrderFulfillmentPath
): ClientFirstOrderStepId {
  const status = order.current_status ?? '';
  if (isFirstOrderSuccessStatus(status)) {
    if (path === 'pickup') return 'picked_up';
    if (path === 'shipping') return 'received';
    return 'delivered';
  }
  if (isFirstOrderTerminalStatus(status)) return 'cancelled';
  if (path === 'pickup') return resolvePickupStep(status);
  if (path === 'shipping') return resolveShippingStep(status);
  return resolveDeliveryStep(order);
}

function withStates(
  templates: StepTemplate[],
  currentStepId: ClientFirstOrderStepId
): ClientFirstOrderStep[] {
  const currentIndex = templates.findIndex((step) => step.id === currentStepId);
  const resolvedIndex = currentIndex >= 0 ? currentIndex : 0;
  return templates.map((step, index) => ({
    ...step,
    state:
      index < resolvedIndex ? 'done' : index === resolvedIndex ? 'current' : 'upcoming',
  }));
}

function pinExplainerFor(
  path: FirstOrderFulfillmentPath,
  stepId: ClientFirstOrderStepId,
  order: ClientFirstOrderOrder
): { key: string | null; defaultValue: string | null } {
  if (!isPinEligible(order)) return { key: null, defaultValue: null };
  if (path === 'delivery' && stepId === 'on_the_way') {
    return { key: PIN_DELIVERY_KEY, defaultValue: PIN_DELIVERY_DEFAULT };
  }
  if (path === 'pickup' && stepId === 'ready_for_pickup') {
    return { key: PIN_PICKUP_KEY, defaultValue: PIN_PICKUP_DEFAULT };
  }
  return { key: null, defaultValue: null };
}

export function getClientFirstOrderPreviewSteps(
  path: FirstOrderFulfillmentPath
): ClientFirstOrderStep[] {
  return withStates(templatesForPath(path, false), 'order_received');
}

export function resolveClientFirstOrderJourney(input: {
  order: ClientFirstOrderOrder;
  /** When null/undefined, eligibility is unknown and the journey stays hidden. */
  clientOrders?: Array<{
    created_at?: string | null;
    current_status?: string | null;
  }> | null;
  isDebugForced?: boolean;
}): ClientFirstOrderJourneyView {
  const isDebugForced = input.isDebugForced ?? isFirstOrderGuidanceForced();
  const eligible =
    input.clientOrders != null && isClientFirstOrderWaveEligible(input.clientOrders);
  const showJourney = isDebugForced || eligible;
  const status = input.order.current_status ?? '';
  const fulfillmentPath = getFirstOrderFulfillmentPath(input.order);
  const currentStepId = resolveClientFirstOrderStepId(input.order, fulfillmentPath);
  const isTerminal = isFirstOrderTerminalStatus(status);
  const isSuccess = isFirstOrderSuccessStatus(status);
  const pin = pinExplainerFor(fulfillmentPath, currentStepId, input.order);
  const includePendingPayment = currentStepId === 'pending_payment';
  const payAtPickup = input.order.payment_timing === 'pay_at_pickup';
  const steps =
    currentStepId === 'cancelled'
      ? [{ ...CANCELLED, state: 'current' as const }]
      : withStates(
          templatesForPath(fulfillmentPath, includePendingPayment, payAtPickup),
          currentStepId
        );

  return {
    showJourney,
    isDebugForced,
    steps,
    currentStepId,
    isTerminal,
    isSuccess,
    fulfillmentPath,
    pinExplainerKey: pin.key,
    pinExplainerDefault: pin.defaultValue,
  };
}

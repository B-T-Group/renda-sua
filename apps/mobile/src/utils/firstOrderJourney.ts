import { isFirstOrderGuidanceForced } from '../config/firstOrderDebug';
import type { JourneyIllustrationId } from './clientOrderJourney';
import { isStorePickupOrder } from './businessOrderListDisplay';
import { isCarrierShipping } from './fulfillmentMethod';
import { getCachedFirstOrderPins } from './firstOrderJourneyStorage';

/** FtueStore nudge id for the legacy one-shot first-order modal. */
export const FIRST_ORDER_ONBOARDING_NUDGE_ID = 'first-order-onboarding';

export type FirstOrderFulfillmentPath = 'delivery' | 'pickup' | 'shipping';

export type FirstOrderJourneyStepId =
  | 'review_confirm'
  | 'pack'
  | 'find_courier'
  | 'hand_over'
  | 'in_delivery'
  | 'ready_collect'
  | 'collect_pickup'
  | 'mark_shipped'
  | 'await_receipt'
  | 'complete'
  | 'cancelled';

export type FirstOrderStepState = 'done' | 'current' | 'upcoming';

export interface FirstOrderJourneyOrder {
  id: string;
  current_status?: string | null;
  fulfillment_method?: string | null;
  payment_timing?: string | null;
  payment_status?: string | null;
  assigned_agent_id?: string | null;
  dispatch_exhausted_at?: string | null;
}

export interface FirstOrderJourneyStep {
  id: FirstOrderJourneyStepId;
  titleKey: string;
  titleDefault: string;
  youDoKey: string;
  youDoDefault: string;
  rendasuaKey: string;
  rendasuaDefault: string;
  illustrationId: JourneyIllustrationId;
  state: FirstOrderStepState;
}

export interface FirstOrderJourneyView {
  showJourney: boolean;
  shouldPin: boolean;
  isDebugForced: boolean;
  isPinned: boolean;
  steps: FirstOrderJourneyStep[];
  currentStepId: FirstOrderJourneyStepId;
  isTerminal: boolean;
  isSuccess: boolean;
  fulfillmentPath: FirstOrderFulfillmentPath;
}

const FAILURE_STATUSES = new Set([
  'cancelled',
  'auto_cancelled',
  'failed',
  'refunded',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_approved_replace',
  'refund_processing',
  'refund_rejected',
  'refund_failed',
]);

const SUCCESS_STATUSES = new Set(['delivered', 'complete', 'completed']);

interface StepTemplate {
  id: FirstOrderJourneyStepId;
  titleKey: string;
  titleDefault: string;
  youDoKey: string;
  youDoDefault: string;
  rendasuaKey: string;
  rendasuaDefault: string;
  illustrationId: JourneyIllustrationId;
}

const REVIEW_STEP: StepTemplate = {
  id: 'review_confirm',
  titleKey: 'business.firstOrder.steps.review.title',
  titleDefault: 'Review and confirm',
  youDoKey: 'business.firstOrder.steps.review.youDo',
  youDoDefault: 'Check the items and tap Confirm order.',
  rendasuaKey: 'business.firstOrder.steps.review.rendasua',
  rendasuaDefault: 'We hold payment until you confirm you can fulfill it.',
  illustrationId: 'received',
};

const PACK_STEP: StepTemplate = {
  id: 'pack',
  titleKey: 'business.firstOrder.steps.pack.title',
  titleDefault: 'Pack the order',
  youDoKey: 'business.firstOrder.steps.pack.youDo',
  youDoDefault: 'Prepare everything in the order, then tap Set as ready.',
  rendasuaKey: 'business.firstOrder.steps.pack.rendasua',
  rendasuaDefault: 'The customer knows you are preparing their order.',
  illustrationId: 'preparing',
};

const DELIVERY_TEMPLATES: StepTemplate[] = [
  REVIEW_STEP,
  PACK_STEP,
  {
    id: 'find_courier',
    titleKey: 'business.firstOrder.steps.findCourier.title',
    titleDefault: 'We find a courier',
    youDoKey: 'business.firstOrder.steps.findCourier.youDo',
    youDoDefault: 'Keep the package ready at your location.',
    rendasuaKey: 'business.firstOrder.steps.findCourier.rendasua',
    rendasuaDefault: 'Nearby delivery agents are notified to claim this order.',
    illustrationId: 'courier',
  },
  {
    id: 'hand_over',
    titleKey: 'business.firstOrder.steps.handOver.title',
    titleDefault: 'Hand over to the agent',
    youDoKey: 'business.firstOrder.steps.handOver.youDo',
    youDoDefault: 'Give the packed order to the agent when they arrive.',
    rendasuaKey: 'business.firstOrder.steps.handOver.rendasua',
    rendasuaDefault: 'The agent delivers it to your customer.',
    illustrationId: 'pickupReady',
  },
  {
    id: 'in_delivery',
    titleKey: 'business.firstOrder.steps.inDelivery.title',
    titleDefault: 'On the way to the customer',
    youDoKey: 'business.firstOrder.steps.inDelivery.youDo',
    youDoDefault: 'Nothing else to do — your part is complete.',
    rendasuaKey: 'business.firstOrder.steps.inDelivery.rendasua',
    rendasuaDefault: 'The agent is delivering the order. You will see when it is complete.',
    illustrationId: 'pin',
  },
];

const PICKUP_TEMPLATES: StepTemplate[] = [
  REVIEW_STEP,
  PACK_STEP,
  {
    id: 'ready_collect',
    titleKey: 'business.firstOrder.steps.readyCollect.title',
    titleDefault: 'Ready for customer pickup',
    youDoKey: 'business.firstOrder.steps.readyCollect.youDo',
    youDoDefault:
      'Keep the order at your store. When the customer arrives, ask for their pickup PIN to confirm the handoff and capture payment.',
    rendasuaKey: 'business.firstOrder.steps.readyCollect.rendasua',
    rendasuaDefault:
      'The customer is notified and can share their pickup PIN from the app.',
    illustrationId: 'pickupReady',
  },
  {
    id: 'collect_pickup',
    titleKey: 'business.firstOrder.steps.collectPickup.title',
    titleDefault: 'Confirm customer pickup',
    youDoKey: 'business.firstOrder.steps.collectPickup.youDo',
    youDoDefault:
      'When the customer arrives, enter their pickup PIN. Payment is captured when pickup is confirmed.',
    rendasuaKey: 'business.firstOrder.steps.collectPickup.rendasua',
    rendasuaDefault: 'Payment is captured and the order is marked complete.',
    illustrationId: 'delivered',
  },
];

const SHIPPING_TEMPLATES: StepTemplate[] = [
  REVIEW_STEP,
  PACK_STEP,
  {
    id: 'mark_shipped',
    titleKey: 'business.firstOrder.steps.markShipped.title',
    titleDefault: 'Ship the order',
    youDoKey: 'business.firstOrder.steps.markShipped.youDo',
    youDoDefault: 'Mark as shipped and add the tracking number.',
    rendasuaKey: 'business.firstOrder.steps.markShipped.rendasua',
    rendasuaDefault: 'The customer can track their package.',
    illustrationId: 'courier',
  },
  {
    id: 'await_receipt',
    titleKey: 'business.firstOrder.steps.awaitReceipt.title',
    titleDefault: 'Customer confirms receipt',
    youDoKey: 'business.firstOrder.steps.awaitReceipt.youDo',
    youDoDefault: 'Nothing else to do — wait for delivery confirmation.',
    rendasuaKey: 'business.firstOrder.steps.awaitReceipt.rendasua',
    rendasuaDefault: 'The customer confirms when the package arrives.',
    illustrationId: 'delivered',
  },
];

const COMPLETE_STEP: StepTemplate = {
  id: 'complete',
  titleKey: 'business.firstOrder.steps.complete.title',
  titleDefault: 'Order complete',
  youDoKey: 'business.firstOrder.steps.complete.youDo',
  youDoDefault: 'You fulfilled your first order on Rendasua.',
  rendasuaKey: 'business.firstOrder.steps.complete.rendasua',
  rendasuaDefault: 'Future orders follow the same steps without this guide.',
  illustrationId: 'delivered',
};

const CANCELLED_STEP: StepTemplate = {
  id: 'cancelled',
  titleKey: 'business.firstOrder.steps.cancelled.title',
  titleDefault: 'Order ended',
  youDoKey: 'business.firstOrder.steps.cancelled.youDo',
  youDoDefault: 'This order was cancelled or could not be completed.',
  rendasuaKey: 'business.firstOrder.steps.cancelled.rendasua',
  rendasuaDefault: 'Your next order will show this guide again.',
  illustrationId: 'cancelled',
};

export function getFirstOrderFulfillmentPath(
  order: Pick<FirstOrderJourneyOrder, 'fulfillment_method'>
): FirstOrderFulfillmentPath {
  if (isCarrierShipping(order.fulfillment_method)) return 'shipping';
  if (isStorePickupOrder(order)) return 'pickup';
  return 'delivery';
}

export function isFirstOrderTerminalStatus(status: string | null | undefined): boolean {
  const s = status ?? '';
  return FAILURE_STATUSES.has(s) || SUCCESS_STATUSES.has(s);
}

export function isFirstOrderSuccessStatus(status: string | null | undefined): boolean {
  return SUCCESS_STATUSES.has(status ?? '');
}

function templatesForPath(path: FirstOrderFulfillmentPath): StepTemplate[] {
  if (path === 'pickup') return PICKUP_TEMPLATES;
  if (path === 'shipping') return SHIPPING_TEMPLATES;
  return DELIVERY_TEMPLATES;
}

function findCourierVariant(order: FirstOrderJourneyOrder): StepTemplate {
  if (order.dispatch_exhausted_at) {
    return {
      ...DELIVERY_TEMPLATES[2],
      rendasuaKey: 'business.firstOrder.steps.findCourier.rendasuaStillLooking',
      rendasuaDefault:
        'Still searching for an agent nearby — we will notify you when one is assigned.',
    };
  }
  return DELIVERY_TEMPLATES[2];
}

function resolveCurrentStepId(
  order: FirstOrderJourneyOrder,
  path: FirstOrderFulfillmentPath
): FirstOrderJourneyStepId {
  const status = order.current_status ?? '';

  if (FAILURE_STATUSES.has(status)) return 'cancelled';
  if (SUCCESS_STATUSES.has(status)) return 'complete';

  if (path === 'delivery') {
    if (status === 'pending') return 'review_confirm';
    if (status === 'confirmed' || status === 'preparing') return 'pack';
    if (status === 'ready_for_pickup') {
      return order.assigned_agent_id ? 'hand_over' : 'find_courier';
    }
    if (status === 'assigned_to_agent' || status === 'picked_up') {
      return 'hand_over';
    }
    if (
      status === 'in_transit' ||
      status === 'out_for_delivery' ||
      status === 'delivered'
    ) {
      return 'in_delivery';
    }
    return 'review_confirm';
  }

  if (path === 'pickup') {
    if (status === 'pending') return 'review_confirm';
    if (status === 'confirmed' || status === 'preparing') return 'pack';
    if (status === 'ready_for_pickup') {
      const needsPayment =
        order.payment_timing === 'pay_at_pickup' &&
        order.payment_status === 'pending';
      if (needsPayment) return 'collect_pickup';
      return 'ready_collect';
    }
    if (status === 'delivered') return 'collect_pickup';
    return 'review_confirm';
  }

  if (status === 'pending') return 'review_confirm';
  if (status === 'confirmed' || status === 'preparing' || status === 'awaiting_shipment') {
    return 'pack';
  }
  if (status === 'shipped' || status === 'in_delivery') return 'await_receipt';
  if (status === 'delivered') return 'await_receipt';
  return 'review_confirm';
}

function buildSteps(
  order: FirstOrderJourneyOrder,
  path: FirstOrderFulfillmentPath,
  currentStepId: FirstOrderJourneyStepId
): FirstOrderJourneyStep[] {
  if (currentStepId === 'complete') {
    return [{ ...COMPLETE_STEP, state: 'current' }];
  }
  if (currentStepId === 'cancelled') {
    return [{ ...CANCELLED_STEP, state: 'current' }];
  }

  let templates = templatesForPath(path);
  if (path === 'delivery' && currentStepId === 'find_courier') {
    templates = [
      REVIEW_STEP,
      PACK_STEP,
      findCourierVariant(order),
      ...DELIVERY_TEMPLATES.slice(3),
    ];
  }

  const currentIndex = templates.findIndex((step) => step.id === currentStepId);
  const resolvedIndex = currentIndex >= 0 ? currentIndex : 0;

  return templates.map((step, index) => ({
    ...step,
    state:
      index < resolvedIndex
        ? 'done'
        : index === resolvedIndex
          ? 'current'
          : 'upcoming',
  }));
}

export function isFirstOrderCountEligible(
  ordersTotal: number | null | undefined
): boolean {
  if (ordersTotal == null) return false;
  return ordersTotal <= 1;
}

export function resolveFirstOrderJourney(input: {
  order: FirstOrderJourneyOrder;
  businessId: string;
  ordersTotal?: number | null;
  isLegacyNudgeConverted?: boolean;
  isDebugForced?: boolean;
}): FirstOrderJourneyView {
  const isDebugForced = input.isDebugForced ?? isFirstOrderGuidanceForced();
  const pins = getCachedFirstOrderPins();
  const pin = pins[input.businessId] ?? null;
  const isPinned = pin?.orderId === input.order.id;
  const pinForOtherOrder = Boolean(pin && pin.orderId !== input.order.id);
  const legacyConverted = input.isLegacyNudgeConverted === true;
  const ordersTotalKnown = input.ordersTotal != null;
  const eligibleToPin =
    ordersTotalKnown &&
    !legacyConverted &&
    isFirstOrderCountEligible(input.ordersTotal) &&
    !pinForOtherOrder;
  const status = input.order.current_status ?? '';
  const isTerminal = isFirstOrderTerminalStatus(status);
  const isSuccess = isFirstOrderSuccessStatus(status);
  const fulfillmentPath = getFirstOrderFulfillmentPath(input.order);
  const currentStepId = resolveCurrentStepId(input.order, fulfillmentPath);
  const steps = buildSteps(input.order, fulfillmentPath, currentStepId);

  let showJourney = false;
  let shouldPin = false;

  if (isDebugForced) {
    showJourney = true;
  } else if (isPinned) {
    showJourney = true;
  } else if (eligibleToPin && !isTerminal) {
    showJourney = true;
    shouldPin = true;
  }

  return {
    showJourney,
    shouldPin,
    isDebugForced,
    isPinned,
    steps,
    currentStepId,
    isTerminal,
    isSuccess,
    fulfillmentPath,
  };
}

export function shouldShowFirstOrderOverlayGuidance(input: {
  orderId: string;
  businessId: string;
  ordersTotal?: number | null;
  isLegacyNudgeConverted?: boolean;
  isDebugForced?: boolean;
}): boolean {
  const isDebugForced = input.isDebugForced ?? isFirstOrderGuidanceForced();
  if (isDebugForced) return true;

  const pin = getCachedFirstOrderPins()[input.businessId];
  if (pin?.orderId === input.orderId) return true;
  if (pin && pin.orderId !== input.orderId) return false;

  if (input.isLegacyNudgeConverted) return false;
  return isFirstOrderCountEligible(input.ordersTotal);
}

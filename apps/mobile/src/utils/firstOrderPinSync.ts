import { isFirstOrderGuidanceForced } from '../config/firstOrderDebug';
import {
  FIRST_ORDER_ONBOARDING_NUDGE_ID,
  isFirstOrderSuccessStatus,
  isFirstOrderTerminalStatus,
  resolveFirstOrderJourney,
} from './firstOrderJourney';
import {
  clearFirstOrderPin,
  getCachedFirstOrderPins,
  pinFirstOrder,
} from './firstOrderJourneyStorage';
import {
  trackFirstOrderCompleted,
  trackFirstOrderLost,
  trackFirstOrderReceived,
} from './firstOrderAnalytics';

type OrderPinSnapshot = {
  id: string;
  business_id: string;
  current_status?: string | null;
  created_at?: string | null;
  fulfillment_method?: string | null;
};

type PinSource = 'overlay' | 'dashboard' | 'detail';

type PinEligibility = {
  businessId: string;
  ordersTotal?: number | null;
  isLegacyNudgeConverted: boolean;
  source: PinSource;
};

export async function ensureFirstOrderPinForOrder(
  order: OrderPinSnapshot,
  params: PinEligibility
): Promise<boolean> {
  const journey = resolveFirstOrderJourney({
    order,
    businessId: params.businessId,
    ordersTotal: params.ordersTotal,
    isLegacyNudgeConverted: params.isLegacyNudgeConverted,
  });
  if (!journey.shouldPin) return false;

  await pinFirstOrder(params.businessId, order.id);
  trackFirstOrderReceived({
    order_id: order.id,
    fulfillment_method: order.fulfillment_method,
    source: params.source,
  });
  return true;
}

export async function syncFirstOrderPinAfterOrderUpdate(
  order: OrderPinSnapshot,
  options?: { convertNudge?: (id: string) => Promise<void> }
): Promise<void> {
  if (isFirstOrderGuidanceForced()) return;

  const pin = getCachedFirstOrderPins()[order.business_id];
  if (!pin || pin.orderId !== order.id) return;

  const status = order.current_status ?? '';
  if (!isFirstOrderTerminalStatus(status)) return;

  const pinnedAt = new Date(pin.pinnedAt).getTime();
  const baseline = Number.isNaN(pinnedAt) ? Date.now() : pinnedAt;
  const minutes = Math.max(0, Math.round((Date.now() - baseline) / 60000));

  if (isFirstOrderSuccessStatus(status)) {
    trackFirstOrderCompleted({
      order_id: order.id,
      minutes_to_complete: minutes,
    });
    await options?.convertNudge?.(FIRST_ORDER_ONBOARDING_NUDGE_ID);
  } else {
    trackFirstOrderLost({
      order_id: order.id,
      terminal_status: status,
    });
  }
  await clearFirstOrderPin(order.business_id);
}

export async function reconcileStaleFirstOrderPin(
  businessId: string,
  activeOrderIds: string[],
  fetchOrderById: (orderId: string) => Promise<OrderPinSnapshot | null>,
  options?: { convertNudge?: (id: string) => Promise<void> }
): Promise<void> {
  if (isFirstOrderGuidanceForced()) return;

  const pin = getCachedFirstOrderPins()[businessId];
  if (!pin || activeOrderIds.includes(pin.orderId)) return;

  let order: OrderPinSnapshot | null;
  try {
    order = await fetchOrderById(pin.orderId);
  } catch {
    return;
  }
  if (!order) return;
  await syncFirstOrderPinAfterOrderUpdate(order, options);
}

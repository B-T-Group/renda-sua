import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStore } from '@/stores/RootStore';
import type { BusinessOrder } from '@/types/business/orders';
import {
  isFirstOrderSuccessStatus,
  isFirstOrderTerminalStatus,
  resolveFirstOrderJourney,
  type FirstOrderJourneyView,
} from '@/utils/firstOrderJourney';
import { pinFirstOrder } from '@/utils/firstOrderJourneyStorage';
import { syncFirstOrderPinAfterOrderUpdate } from '@/utils/firstOrderPinSync';
import {
  trackFirstOrderOpened,
  trackFirstOrderReceived,
  trackFirstOrderStepViewed,
} from '@/utils/firstOrderAnalytics';

export function useFirstOrderJourney(params: {
  order: BusinessOrder | null;
  businessId: string | null | undefined;
  ordersTotal?: number | null;
  source?: 'overlay' | 'dashboard' | 'detail';
}): FirstOrderJourneyView | null {
  const { ftue } = useStore();
  const pinnedRef = useRef(false);
  const openedRef = useRef(false);
  const stepSeenRef = useRef<Set<string>>(new Set());
  const terminalHandledRef = useRef(false);

  const legacyConverted = !ftue.isNudgeEligible('first-order-onboarding');

  const journey = useMemo(() => {
    if (!params.order || !params.businessId) return null;
    return resolveFirstOrderJourney({
      order: params.order,
      businessId: params.businessId,
      ordersTotal: params.ordersTotal,
      isLegacyNudgeConverted: legacyConverted,
    });
  }, [params.order, params.businessId, params.ordersTotal, legacyConverted]);

  useEffect(() => {
    pinnedRef.current = false;
    openedRef.current = false;
    stepSeenRef.current = new Set();
    terminalHandledRef.current = false;
  }, [params.order?.id]);

  useEffect(() => {
    if (!journey?.shouldPin || !params.order || !params.businessId) return;
    if (pinnedRef.current) return;
    pinnedRef.current = true;
    void pinFirstOrder(params.businessId, params.order.id).then(() => {
      trackFirstOrderReceived({
        order_id: params.order!.id,
        fulfillment_method: params.order!.fulfillment_method,
        source: params.source ?? 'detail',
      });
    });
  }, [journey?.shouldPin, params.businessId, params.order, params.source]);

  useEffect(() => {
    if (!journey?.showJourney || !params.order) return;
    if (openedRef.current) return;
    openedRef.current = true;
    trackFirstOrderOpened({
      order_id: params.order.id,
      fulfillment_method: params.order.fulfillment_method,
      status: params.order.current_status,
    });
  }, [journey?.showJourney, params.order]);

  useEffect(() => {
    if (!journey?.showJourney || !params.order) return;
    const key = `${params.order.current_status}:${journey.currentStepId}`;
    if (stepSeenRef.current.has(key)) return;
    stepSeenRef.current.add(key);
    trackFirstOrderStepViewed({
      order_id: params.order.id,
      step_id: journey.currentStepId,
      status: params.order.current_status,
    });
  }, [
    journey?.showJourney,
    journey?.currentStepId,
    params.order?.id,
    params.order?.current_status,
  ]);

  const clearPinIfTerminal = useCallback(async () => {
    if (!params.order || !params.businessId || terminalHandledRef.current) return;
    if (!journey?.isPinned) return;
    const status = params.order.current_status ?? '';
    if (!isFirstOrderTerminalStatus(status)) return;
    if (journey.isDebugForced) return;

    terminalHandledRef.current = true;
    await syncFirstOrderPinAfterOrderUpdate(params.order, {
      convertNudge: (id) => ftue.convertNudge(id),
    });
  }, [ftue, journey?.isDebugForced, journey?.isPinned, params.businessId, params.order]);

  useEffect(() => {
    if (!params.order || !journey?.isPinned) return;
    if (!isFirstOrderTerminalStatus(params.order.current_status)) return;
    void clearPinIfTerminal();
  }, [
    clearPinIfTerminal,
    journey?.isPinned,
    params.order?.current_status,
    params.order?.id,
  ]);

  useEffect(() => {
    return () => {
      if (!journey?.isPinned || journey.isDebugForced) return;
      if (!params.order || !isFirstOrderTerminalStatus(params.order.current_status)) {
        return;
      }
      void clearPinIfTerminal();
    };
  }, [clearPinIfTerminal, journey?.isDebugForced, journey?.isPinned, params.order]);

  if (!journey?.showJourney) return null;
  return journey;
}

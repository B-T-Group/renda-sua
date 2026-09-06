import { useEffect, useMemo, useRef } from 'react';
import {
  resolveClientFirstOrderJourney,
  type ClientFirstOrderJourneyView,
  type ClientFirstOrderOrder,
} from '../../utils/firstOrderClientJourney';
import {
  trackFirstOrderClientCompleted,
  trackFirstOrderClientLost,
  trackFirstOrderClientOpened,
  trackFirstOrderClientStepViewed,
} from '../../utils/firstOrderClientAnalytics';

/** Session-scoped dedupe so remounting order detail does not re-fire FTUE events. */
const trackedClientFirstOrderEvents = new Set<string>();

function claimEvent(key: string): boolean {
  if (trackedClientFirstOrderEvents.has(key)) return false;
  trackedClientFirstOrderEvents.add(key);
  return true;
}

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const created = Date.parse(iso);
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.round((Date.now() - created) / 60000));
}

function trackTerminal(
  order: ClientFirstOrderOrder,
  journey: ClientFirstOrderJourneyView
): void {
  if (!claimEvent(`terminal:${order.id}`)) return;
  if (journey.isSuccess) {
    trackFirstOrderClientCompleted({
      order_id: order.id,
      minutes_to_complete: minutesSince(order.created_at),
    });
    return;
  }
  trackFirstOrderClientLost({
    order_id: order.id,
    terminal_status: order.current_status ?? 'unknown',
  });
}

export function useFirstOrderClientJourney(params: {
  order: ClientFirstOrderOrder | null;
  /** Null while loading/error so eligibility stays unknown. */
  clientOrders?: Array<{
    created_at?: string | null;
    current_status?: string | null;
  }> | null;
}): ClientFirstOrderJourneyView | null {
  const journey = useMemo(() => {
    if (!params.order) return null;
    return resolveClientFirstOrderJourney({
      order: params.order,
      clientOrders: params.clientOrders,
    });
  }, [params.order, params.clientOrders]);

  useEffect(() => {
    if (!journey?.showJourney || !params.order) return;
    if (!claimEvent(`opened:${params.order.id}`)) return;
    trackFirstOrderClientOpened({
      order_id: params.order.id,
      fulfillment_method: params.order.fulfillment_method,
      status: params.order.current_status,
    });
  }, [journey?.showJourney, params.order]);

  useEffect(() => {
    if (!journey?.showJourney || !params.order) return;
    const key = `step:${params.order.id}:${params.order.current_status}:${journey.currentStepId}`;
    if (!claimEvent(key)) return;
    trackFirstOrderClientStepViewed({
      order_id: params.order.id,
      step_id: journey.currentStepId,
      status: params.order.current_status,
    });
  }, [journey?.showJourney, journey?.currentStepId, params.order]);

  useEffect(() => {
    if (!journey?.showJourney || !params.order || !journey.isTerminal) return;
    trackTerminal(params.order, journey);
  }, [journey, params.order]);

  if (!journey?.showJourney) return null;
  return journey;
}

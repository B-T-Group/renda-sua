import { AppEventsService } from '../services/analytics/AppEventsService';
import type { ReorderCartAction, ReorderNavigationHint } from '../types/reorder';

export type ReorderEventName =
  | 'reorder_impression'
  | 'reorder_tap'
  | 'reorder_result';

const EVENT_TYPE_MAP: Record<ReorderEventName, string> = {
  reorder_impression: 'orders.reorder.impression',
  reorder_tap: 'orders.reorder.tap',
  reorder_result: 'orders.reorder.result',
};

export function trackReorderEvent(
  event: ReorderEventName,
  properties: {
    orderId?: string;
    dest?: ReorderNavigationHint;
    skipped_count?: number;
    cart_action?: ReorderCartAction;
  } = {}
): void {
  AppEventsService.track({
    eventType: EVENT_TYPE_MAP[event],
    metadata: { ...properties, source: 'mobile' },
  });
}

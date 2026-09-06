/**
 * Cancellation funnel analytics events.
 * Fire-and-forget — errors are silently swallowed so they never affect the
 * cancellation UX.
 */

import { AppEventsService } from '../services/analytics/AppEventsService';

export type CancellationEventName =
  | 'cancellation_dialog_opened'
  | 'cancellation_preview_loaded'
  | 'cancellation_preview_failed'
  | 'cancellation_reason_selected'
  | 'cancellation_confirmed'
  | 'cancellation_abandoned'
  | 'cancellation_blocked_shown';

const EVENT_TYPE_MAP: Record<CancellationEventName, string> = {
  cancellation_dialog_opened: 'cancellation.dialog_opened',
  cancellation_preview_loaded: 'cancellation.preview_loaded',
  cancellation_preview_failed: 'cancellation.preview_failed',
  cancellation_reason_selected: 'cancellation.reason_selected',
  cancellation_confirmed: 'cancellation.confirmed',
  cancellation_abandoned: 'cancellation.abandoned',
  cancellation_blocked_shown: 'cancellation.blocked_shown',
};

export interface CancellationEventProperties {
  orderId?: string;
  orderStatus?: string;
  paymentSource?: string;
  canCancel?: boolean;
  refundType?: string;
  reasonValue?: string;
  reasonId?: number | null;
  hasNotes?: boolean;
  reasonSelected?: boolean;
  error?: string;
  reason?: string;
}

export function trackCancellationEvent(
  event: CancellationEventName,
  properties: CancellationEventProperties = {}
): void {
  AppEventsService.track({
    eventType: EVENT_TYPE_MAP[event],
    metadata: { ...properties, source: 'mobile' },
  });
}

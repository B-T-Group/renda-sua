/**
 * Product-creation funnel analytics.
 * Fire-and-forget — errors are silently swallowed so they never affect UX.
 */

import { AppEventsService } from '../services/analytics/AppEventsService';

export type ProductCreateEventName =
  | 'product_create.flow_opened'
  | 'product_create.photo_captured'
  | 'product_create.photo_upload_completed'
  | 'product_create.hint_shown'
  | 'product_create.hint_submitted'
  | 'product_create.hint_skipped'
  | 'product_create.ai_suggestions_returned'
  | 'product_create.ai_failed'
  | 'product_create.field_edited'
  | 'product_create.duplicate_warning_shown'
  | 'product_create.duplicate_add_stock_chosen'
  | 'product_create.preview_opened'
  | 'product_create.published'
  | 'product_create.saved_for_later'
  | 'product_create.draft_resumed'
  | 'product_create.add_another_tapped'
  | 'product_create.enrichment_nudge_shown'
  | 'product_create.enrichment_nudge_accepted'
  | 'product_create.cleanup_opted_in'
  | 'product_create.cleanup_skipped';

export function trackProductCreateEvent(
  event: ProductCreateEventName,
  properties: Record<string, unknown> = {}
): void {
  AppEventsService.track({
    eventType: event,
    metadata: { ...properties, source: 'mobile' },
  });
}

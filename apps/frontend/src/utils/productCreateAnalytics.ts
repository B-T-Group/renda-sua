/**
 * Product-creation funnel analytics (web).
 * Fire-and-forget — errors are silently swallowed.
 */

import type { AxiosInstance } from 'axios';

export type ProductCreateEventName =
  | 'product_create.flow_opened'
  | 'product_create.hint_submitted'
  | 'product_create.ai_suggestions_returned'
  | 'product_create.published'
  | 'product_create.saved_for_later'
  | 'product_create.enrichment_nudge_shown'
  | 'product_create.enrichment_nudge_accepted';

export function trackProductCreateEvent(
  apiClient: AxiosInstance | null | undefined,
  event: ProductCreateEventName,
  properties: Record<string, unknown> = {}
): void {
  if (!apiClient) return;
  apiClient
    .post('/site-events', { event, properties, source: 'web' })
    .catch(() => {
      // analytics errors must never surface to the user
    });
}

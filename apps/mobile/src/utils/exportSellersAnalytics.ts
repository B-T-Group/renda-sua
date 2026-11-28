import { AppEventsService } from '../services/analytics/AppEventsService';
import type { ExportSellersContext } from './exportSellers';

export type ExportSellerEventName =
  | 'exports_sellers_carousel_viewed'
  | 'exports_seller_card_tapped'
  | 'exports_sellers_more_tapped'
  | 'exports_sellers_list_viewed'
  | 'exports_sellers_search_submitted'
  | 'exports_seller_page_viewed'
  | 'exports_seller_page_search_submitted';

/** Fire-and-forget. Never sends the raw search query (only its length). */
export function trackExportSellerEvent(
  event: ExportSellerEventName,
  ctx: ExportSellersContext,
  extra: Record<string, string | number> = {}
): void {
  AppEventsService.track({
    eventType: event,
    metadata: {
      direction: ctx.direction,
      ...(ctx.marketCode ? { market_code: ctx.marketCode } : {}),
      ...(ctx.direction === 'from' && ctx.originCode ? { origin_code: ctx.originCode } : {}),
      ...extra,
      source_app: 'mobile',
    },
  });
}

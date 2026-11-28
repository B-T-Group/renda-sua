import { useCallback } from 'react';
import { useTrackSiteEvent, type SiteEventTypeV1 } from './useTrackSiteEvent';
import type { ExportSellersContext } from '../utils/exportSellers';

type ExportSellerEvent = Extract<SiteEventTypeV1, `exports_seller${string}`>;

/** Fire-and-forget exports seller analytics. Search sends query_len only, never the text. */
export function useExportSellerTracking(ctx: ExportSellersContext) {
  const { trackSiteEvent } = useTrackSiteEvent();
  const { direction, marketCode, originCode } = ctx;
  return useCallback(
    (eventType: ExportSellerEvent, extra: Record<string, string | number> = {}) => {
      void trackSiteEvent({
        eventType,
        metadata: {
          direction,
          ...(marketCode ? { market_code: marketCode } : {}),
          ...(direction === 'from' && originCode ? { origin_code: originCode } : {}),
          ...extra,
          source_app: 'web',
        },
      });
    },
    [trackSiteEvent, direction, marketCode, originCode]
  );
}

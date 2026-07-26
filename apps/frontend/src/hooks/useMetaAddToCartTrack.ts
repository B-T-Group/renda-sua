import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';
import { getOrCreateRsAnonymousId } from '../utils/rsAnonymousId';
import { useApiClient } from './useApiClient';
import type { MetaPixelProductEventParams } from './useMetaPixel';
import { useMetaPixel } from './useMetaPixel';
import { metaFunnelEventId } from '../utils/metaEventIds';

/**
 * Pixel AddToCart + server CAPI POST /track-add-to-cart with shared eventID.
 */
export function useMetaAddToCartTrack() {
  const apiClient = useApiClient();
  const { isAuthenticated, user } = useAuth0();
  const { trackAddToCart } = useMetaPixel();

  return useCallback(
    (params: MetaPixelProductEventParams) => {
      const eventID = metaFunnelEventId();
      trackAddToCart(params, { eventID });

      if (!apiClient || !params.content_ids[0]) return;

      const headers: Record<string, string> = {
        'x-rendasua-platform': 'web',
      };
      if (isAuthenticated && user?.sub) {
        headers['X-User-Id'] = user.sub;
      } else {
        headers['X-Anonymous-Id'] = getOrCreateRsAnonymousId();
      }

      const qty = params.contents?.[0]?.quantity ?? 1;
      void apiClient
        .post(
          '/track-add-to-cart',
          {
            inventoryItemId: params.content_ids[0],
            quantity: qty,
            value: params.value,
            currency: params.currency,
            contentName: params.content_name,
            contentCategory: params.content_category,
            eventId: eventID,
          },
          { headers }
        )
        .catch(() => {
          // CAPI track must never break add-to-cart UX
        });
    },
    [apiClient, isAuthenticated, trackAddToCart, user?.sub]
  );
}

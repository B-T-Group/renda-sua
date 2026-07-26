import { useCallback } from 'react';

type FbqStandardEvent =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase';

type FbqFn = (
  command: 'track' | 'init',
  eventOrId: string,
  params?: unknown,
  options?: { eventID?: string }
) => void;

function fbq(): FbqFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { fbq?: FbqFn };
  return typeof w.fbq === 'function' ? w.fbq : null;
}

export type MetaPixelProductEventParams = {
  content_type: 'product' | 'product_group';
  content_ids: string[];
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  value?: number;
  currency?: string;
  content_name?: string;
  /** e.g. "Electronics > Phones" (Meta custom data). */
  content_category?: string;
  /** Google product taxonomy id or path (aligns with catalog `google_product_category`). */
  google_product_category?: string;
};

export type MetaPixelTrackOptions = {
  eventID?: string;
};

export function useMetaPixel() {
  const track = useCallback(
    (
      event: FbqStandardEvent,
      params?: unknown,
      options?: MetaPixelTrackOptions
    ) => {
      const f = fbq();
      if (!f) return;
      try {
        if (options?.eventID) {
          f('track', event, params, { eventID: options.eventID });
        } else {
          f('track', event, params);
        }
      } catch {
        // Intentionally ignore pixel failures to avoid breaking UX.
      }
    },
    []
  );

  const trackViewContent = useCallback(
    (params: MetaPixelProductEventParams, options?: MetaPixelTrackOptions) =>
      track('ViewContent', params, options),
    [track]
  );

  const trackAddToCart = useCallback(
    (params: MetaPixelProductEventParams, options?: MetaPixelTrackOptions) =>
      track('AddToCart', params, options),
    [track]
  );

  const trackPurchase = useCallback(
    (params: MetaPixelProductEventParams, options?: MetaPixelTrackOptions) =>
      track('Purchase', params, options),
    [track]
  );

  return { track, trackViewContent, trackAddToCart, trackPurchase };
}

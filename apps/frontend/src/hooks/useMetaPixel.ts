import { useCallback } from 'react';

type FbqStandardEvent =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase';

type FbqFn = (command: 'track' | 'init', eventOrId: string, params?: unknown) => void;

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
};

export function useMetaPixel() {
  const track = useCallback((event: FbqStandardEvent, params?: unknown) => {
    const f = fbq();
    if (!f) return;
    try {
      f('track', event, params);
    } catch {
      // Intentionally ignore pixel failures to avoid breaking UX.
    }
  }, []);

  const trackViewContent = useCallback(
    (params: MetaPixelProductEventParams) => track('ViewContent', params),
    [track]
  );

  const trackAddToCart = useCallback(
    (params: MetaPixelProductEventParams) => track('AddToCart', params),
    [track]
  );

  const trackPurchase = useCallback(
    (params: MetaPixelProductEventParams) => track('Purchase', params),
    [track]
  );

  return { track, trackViewContent, trackAddToCart, trackPurchase };
}


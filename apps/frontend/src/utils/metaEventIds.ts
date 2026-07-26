/** Stable Purchase event_id shared by Pixel + Meta CAPI. */
export function metaPurchaseEventId(orderId: string): string {
  return `purchase-${orderId}`;
}

/** One-off funnel event id (ViewContent / AddToCart) for Pixel + CAPI dedupe. */
export function metaFunnelEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `meta-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

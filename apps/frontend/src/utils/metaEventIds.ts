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

export type MetaCheckoutEventItem = {
  business_inventory_id: string;
  quantity: number;
  item_variant_id?: string;
};

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Deterministic InitiateCheckout event_id matching backend
 * `resolveCheckoutEventId` (checkout- + first 32 hex of SHA-256 of sorted cart key).
 */
export async function metaCheckoutEventId(
  items: MetaCheckoutEventItem[]
): Promise<string> {
  const key = items
    .map(
      (i) =>
        `${i.business_inventory_id}:${i.quantity}:${i.item_variant_id ?? ''}`
    )
    .sort()
    .join('|');

  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof TextEncoder !== 'undefined'
  ) {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(key)
    );
    return `checkout-${bytesToHex(digest).slice(0, 32)}`;
  }

  // Extremely old environments without Web Crypto — still stable for the session.
  return `checkout-${key.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || Date.now()}`;
}

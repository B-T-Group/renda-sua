export const ORDER_PAID_EVENT = 'order.paid';

export const META_STANDARD_EVENTS = [
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
] as const;

export type MetaStandardEventName = (typeof META_STANDARD_EVENTS)[number];

export function metaPurchaseEventId(orderId: string): string {
  return `purchase-${orderId}`;
}

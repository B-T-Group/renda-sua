export const ORDER_PAID_EVENT = 'order.paid';

export const META_STANDARD_EVENTS = [
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'CompleteRegistration',
] as const;

export type MetaStandardEventName = (typeof META_STANDARD_EVENTS)[number];

/** Meta custom_data.user_type values for CompleteRegistration. */
export type MetaRegistrationUserType =
  | 'client'
  | 'delivery_agent'
  | 'business';

export function metaPurchaseEventId(orderId: string): string {
  return `purchase-${orderId}`;
}

export function metaRegistrationEventId(userId: string): string {
  return `registration-${userId}`;
}

export function metaUserTypeFromPersona(
  persona: string | null | undefined
): MetaRegistrationUserType {
  if (persona === 'agent') return 'delivery_agent';
  if (persona === 'business') return 'business';
  return 'client';
}

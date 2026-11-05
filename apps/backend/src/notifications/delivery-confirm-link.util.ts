/** Spec P1: the delivered/reminder notification opens the confirm screen in the client persona. */
export const DELIVERY_CONFIRM_SCREEN = 'delivery-confirm';

export type DeliveryConfirmSource = 'push' | 'wa' | 'sms' | 'in_app';

export function deliveryConfirmPath(orderId: string): string {
  return `/orders/${orderId}/confirm?persona=client`;
}

/**
 * Extra push data for the client when an order is waiting for their confirmation.
 * Other recipients and statuses get nothing extra (existing order deep link).
 */
export function deliveryConfirmPushData(
  status: string,
  recipientType: string,
  orderId: string
): Record<string, string> {
  if (recipientType !== 'client') return {};
  if (status !== 'awaiting_client_confirmation') return {};
  return {
    url: deliveryConfirmPath(orderId),
    screen: DELIVERY_CONFIRM_SCREEN,
    targetPersona: 'client',
    source: 'push',
  };
}

import { normalizeLanguage } from './email-template-data';

function storePickupReminderCopy(orderNumber: string, isFr: boolean) {
  if (isFr) {
    return {
      title: 'Commande à récupérer',
      body: `Votre commande ${orderNumber} vous attend. Touchez pour annuler, écrire au commerce, ou fermer.`,
    };
  }
  return {
    title: 'Order ready for pickup',
    body: `Your order ${orderNumber} is waiting. Tap to cancel, message the store, or close.`,
  };
}

export function storePickupReminderDedupeKey(
  orderId: string,
  now: Date = new Date()
): string {
  return `order.store_pickup.reminder:${orderId}:${now
    .toISOString()
    .slice(0, 13)}`;
}

function storePickupReminderNotifyPayload(
  userId: string,
  params: {
    orderId: string;
    orderNumber: string;
    preferredLanguage?: string | null;
    now?: Date;
  }
) {
  const locale = normalizeLanguage(params.preferredLanguage);
  const copy = storePickupReminderCopy(params.orderNumber, locale === 'fr');
  const path = `/orders/${params.orderId}?pickupReminder=1`;
  return {
    type: 'order.store_pickup.reminder' as const,
    category: 'actionable' as const,
    recipientUserId: userId,
    locale,
    preferenceCategory: 'order_updates' as const,
    entityType: 'order' as const,
    entityId: params.orderId,
    dedupeKey: storePickupReminderDedupeKey(params.orderId, params.now),
    channels: {
      push: {
        title: copy.title,
        body: copy.body,
        interruptible: true,
        data: {
          url: path,
          orderId: params.orderId,
          orderNumber: params.orderNumber,
          event: 'store_pickup_reminder',
          persona: 'client',
        },
      },
    },
  };
}

export function buildStorePickupReminderNotify(params: {
  clientUserId?: string | null;
  orderId: string;
  orderNumber: string;
  preferredLanguage?: string | null;
  now?: Date;
}) {
  const userId = params.clientUserId?.trim();
  if (!userId) return null;
  return storePickupReminderNotifyPayload(userId, params);
}

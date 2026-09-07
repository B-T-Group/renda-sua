/**
 * Some backend messages are stored as serialised i18n descriptors, e.g.
 *   {"i18nKey":"orders.messaging.deliveryPin.shared","params":{"agentName":"Alice"}}
 *
 * This utility resolves them to a human-readable string using the active
 * i18next `t` function. Unknown keys fall back to the raw message string.
 */

type TFunc = (key: string, fallback: string, params?: Record<string, unknown>) => string;

interface I18nDescriptor {
  i18nKey: string;
  params?: Record<string, unknown>;
  defaultMessage?: string;
}

const FALLBACKS: Record<string, string> = {
  'orders.messaging.deliveryPin.shared': 'Delivery PIN sent to {{agentName}}',
  'orders.messaging.deliveryPin.sharedPickup': 'Pickup PIN sent to {{businessName}}',
  'rentals.messaging.startPin.shared': 'Start PIN sent to {{businessName}}',
  'orders.noAgentFound.message':
    "We couldn't find a nearby courier for order #{{orderNumber}}. Check your order for options.",
  'items.availability.requestMessage': 'Availability check for {{itemName}}',
  'orders.quickMessages.fallback': 'Quick message',
  'orders.quickMessages.agentArrived.body': "I've arrived at your location",
  'orders.quickMessages.clientUnreachable.body': 'Unable to reach the client',
  'orders.quickMessages.onMyWay.body': "I'm on my way with your order",
  'orders.quickMessages.runningLateToClient.body': 'Running a few minutes late',
  'orders.quickMessages.clientComingDown.body':
    "I'm coming down / will meet you shortly",
  'orders.quickMessages.clientCallMe.body': 'Please call me when you arrive',
  'orders.quickMessages.orderReadyForPickup.body': 'Order is ready for pickup',
  'orders.quickMessages.needClientContact.body': 'Please help us reach the client',
};

/** Keys that need a plain (non-rich) locale entry for list/preview contexts. */
const PLAIN_KEYS: Record<string, string> = {
  'orders.messaging.deliveryPin.shared': 'orders.messaging.deliveryPin.sharedPlain',
  'orders.messaging.deliveryPin.sharedPickup': 'orders.messaging.deliveryPin.sharedPickup',
  'rentals.messaging.startPin.shared': 'rentals.messaging.startPin.sharedPlain',
  'orders.noAgentFound.message': 'orders.noAgent.messagePlain',
};

export function resolveMessageText(rawMessage: string, t: TFunc): string {
  try {
    const descriptor = JSON.parse(rawMessage) as I18nDescriptor;
    if (typeof descriptor.i18nKey !== 'string') return rawMessage;
    const lookupKey = PLAIN_KEYS[descriptor.i18nKey] ?? descriptor.i18nKey;
    const fallback =
      descriptor.defaultMessage ??
      FALLBACKS[descriptor.i18nKey] ??
      descriptor.i18nKey;
    return t(lookupKey, fallback, descriptor.params ?? {});
  } catch {
    return rawMessage;
  }
}

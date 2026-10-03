/** Android channel ids. Existing installs ignore sound changes on an old channel. */
export const ORDER_INCOMING_ALARM_CHANNEL_ID = 'order_incoming_alarm';
export const ORDER_OFFERS_ALARM_CHANNEL_ID = 'order_offers_alarm';

/** Merchant incoming-order interrupt (alarm stream, audible in vibrate mode). */
export const MERCHANT_INCOMING_ORDER_PUSH = {
  priority: 'high' as const,
  sound: 'default' as const,
  channelId: ORDER_INCOMING_ALARM_CHANNEL_ID,
};

/** Agent delivery-offer interrupt. TTL is the offer window. */
export function orderOfferPushOptions(ttlSeconds?: number) {
  return {
    priority: 'high' as const,
    sound: 'default' as const,
    channelId: ORDER_OFFERS_ALARM_CHANNEL_ID,
    ttlSeconds,
  };
}

/** Dismiss an offer on the same channel the offer used, without restarting the sound. */
export const ORDER_OFFER_CANCELLED_PUSH = {
  priority: 'high' as const,
  channelId: ORDER_OFFERS_ALARM_CHANNEL_ID,
};

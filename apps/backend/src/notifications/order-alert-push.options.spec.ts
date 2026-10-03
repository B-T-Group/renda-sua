import {
  MERCHANT_INCOMING_ORDER_PUSH,
  ORDER_INCOMING_ALARM_CHANNEL_ID,
  ORDER_OFFER_CANCELLED_PUSH,
  ORDER_OFFERS_ALARM_CHANNEL_ID,
  orderOfferPushOptions,
} from './order-alert-push.options';

describe('order alert push options', () => {
  it('uses new alarm channel ids so Android will play the sound', () => {
    expect(ORDER_INCOMING_ALARM_CHANNEL_ID).toBe('order_incoming_alarm');
    expect(ORDER_OFFERS_ALARM_CHANNEL_ID).toBe('order_offers_alarm');
    expect(MERCHANT_INCOMING_ORDER_PUSH).toEqual({
      priority: 'high',
      sound: 'default',
      channelId: 'order_incoming_alarm',
    });
  });

  it('keeps the offer ttl and does not attach a sound to the cancellation', () => {
    expect(orderOfferPushOptions(60)).toEqual({
      priority: 'high',
      sound: 'default',
      channelId: 'order_offers_alarm',
      ttlSeconds: 60,
    });
    expect(orderOfferPushOptions()).toEqual({
      priority: 'high',
      sound: 'default',
      channelId: 'order_offers_alarm',
      ttlSeconds: undefined,
    });
    expect(ORDER_OFFER_CANCELLED_PUSH).toEqual({
      priority: 'high',
      channelId: 'order_offers_alarm',
    });
    expect(ORDER_OFFER_CANCELLED_PUSH).not.toHaveProperty('sound');
  });
});

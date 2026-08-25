import {
  incomingOrderDelegateEvent,
  incomingOrderExpoOptions,
  isIncomingOrderInterruptible,
  MERCHANT_INCOMING_ORDER_PUSH,
} from './merchant-incoming-order-push';

describe('merchant incoming-order push flags', () => {
  it('interrupts ASAP and unspecified acceptance modes', () => {
    expect(isIncomingOrderInterruptible('asap')).toBe(true);
    expect(isIncomingOrderInterruptible(undefined)).toBe(true);
    expect(incomingOrderDelegateEvent('asap')).toBe('order_created');
    expect(incomingOrderExpoOptions(undefined)).toEqual(
      MERCHANT_INCOMING_ORDER_PUSH
    );
    expect(MERCHANT_INCOMING_ORDER_PUSH).toEqual({
      priority: 'high',
      sound: 'default',
      channelId: 'order_incoming',
    });
  });

  it('keeps scheduled orders quiet until SLA activation', () => {
    expect(isIncomingOrderInterruptible('scheduled')).toBe(false);
    expect(incomingOrderDelegateEvent('scheduled')).toBe('order_scheduled');
    expect(incomingOrderExpoOptions('scheduled')).toBeUndefined();
  });
});

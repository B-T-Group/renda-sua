import { resolvePayOnDeliveryDefault } from './item-payment-defaults.util';

describe('resolvePayOnDeliveryDefault', () => {
  it('defaults on for mobile money when unset', () => {
    expect(resolvePayOnDeliveryDefault('mobile_money')).toBe(true);
    expect(resolvePayOnDeliveryDefault('mobile_money', undefined)).toBe(true);
    expect(resolvePayOnDeliveryDefault('mobile_money', null)).toBe(true);
  });

  it('defaults off for stripe when unset', () => {
    expect(resolvePayOnDeliveryDefault('stripe')).toBe(false);
  });

  it('respects an explicit boolean', () => {
    expect(resolvePayOnDeliveryDefault('mobile_money', false)).toBe(false);
    expect(resolvePayOnDeliveryDefault('stripe', true)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { orderNeedsPayAtDeliveryAgentActions } from './orderPaymentAgentActions';

describe('orderNeedsPayAtDeliveryAgentActions', () => {
  it('hides collect-at-delivery actions for cooked-food pay-after', () => {
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_timing: 'pay_at_delivery',
        payment_method: 'pay_on_delivery',
        pay_after_merchant_confirm: true,
      })
    ).toBe(false);
  });

  it('keeps classic pay-at-delivery and pay-on-delivery orders', () => {
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_timing: 'pay_at_delivery',
        payment_method: null,
        pay_after_merchant_confirm: false,
      })
    ).toBe(true);
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_timing: null,
        payment_method: 'pay_on_delivery',
        pay_after_merchant_confirm: null,
      })
    ).toBe(true);
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_timing: 'pay_now',
        payment_method: 'mobile_money',
        pay_after_merchant_confirm: false,
      })
    ).toBe(false);
  });

  it('hides collect actions for flagged-location (non-cooked) pay-after delivery orders', () => {
    // Flagged goods orders are stored like cooked pay-after: pay_at_delivery timing + flag.
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_timing: 'pay_at_delivery',
        payment_method: 'mobile_money',
        pay_after_merchant_confirm: true,
      })
    ).toBe(false);
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_timing: 'pay_at_pickup',
        payment_method: 'pay_on_delivery',
        pay_after_merchant_confirm: true,
      })
    ).toBe(false);
  });
});

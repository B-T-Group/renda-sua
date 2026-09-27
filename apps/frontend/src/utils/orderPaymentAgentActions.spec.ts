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
        pay_after_merchant_confirm: false,
      })
    ).toBe(true);
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_method: 'pay_on_delivery',
      })
    ).toBe(true);
    expect(
      orderNeedsPayAtDeliveryAgentActions({
        payment_timing: 'pay_now',
        payment_method: 'mobile_money',
      })
    ).toBe(false);
  });
});

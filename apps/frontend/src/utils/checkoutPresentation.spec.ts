import { buildCheckoutPresentation } from './checkoutPresentation';

const group = {
  allowed_payment_timings: ['pay_now', 'pay_at_delivery', 'pay_at_pickup'] as const,
  pickup_eligible: true,
  shipping_eligible: false,
};

describe('buildCheckoutPresentation', () => {
  it('hides pay-now Mobile Money on delivery when that rail is off', () => {
    const view = buildCheckoutPresentation(
      {
        checkout_method: 'MOBILE_MONEY',
        groups: [{ ...group, allowed_payment_timings: [...group.allowed_payment_timings] }],
        delivery_availability: { available: true },
        momo_pay_now_delivery_enabled: false,
      },
      'delivery'
    );
    expect(view.payments).toEqual(['pay_at_delivery']);
  });

  it('keeps pay-after-confirm as the only payment choice', () => {
    const view = buildCheckoutPresentation(
      {
        checkout_method: 'MOBILE_MONEY',
        groups: [{ ...group, allowed_payment_timings: [...group.allowed_payment_timings] }],
        pay_after_merchant_confirm_eligible: true,
        deposit_required: true,
      },
      'pickup'
    );
    expect(view.payments).toEqual(['pay_after_confirm']);
  });
});

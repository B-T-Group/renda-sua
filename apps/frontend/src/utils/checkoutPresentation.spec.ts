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

  it('returns no choices when preflight is missing', () => {
    expect(buildCheckoutPresentation(null, 'delivery')).toEqual({
      fulfillment: [],
      payments: [],
      showSchedule: false,
    });
  });

  it('drops delivery when it is unavailable and hides a timing that is not on every group', () => {
    const view = buildCheckoutPresentation(
      {
        checkout_method: 'STRIPE',
        groups: [
          { ...group, allowed_payment_timings: ['pay_now', 'pay_at_delivery'] },
          { ...group, allowed_payment_timings: ['pay_now'], shipping_eligible: true },
        ],
        delivery_availability: { available: false },
        can_pay_with_wallet: true,
      },
      'delivery'
    );
    expect(view.fulfillment).toEqual(['pickup']);
    expect(view.payments).toEqual(['wallet', 'card']);
    expect(view.payments).not.toContain('pay_at_delivery');
  });

  it('keeps Mobile Money pay-now on pickup when the delivery rail is off', () => {
    const view = buildCheckoutPresentation(
      {
        checkout_method: 'MOBILE_MONEY',
        groups: [{ ...group, allowed_payment_timings: ['pay_now'] }],
        momo_pay_now_delivery_enabled: false,
        schedule_allowed: true,
      },
      'pickup'
    );
    expect(view.payments).toEqual(['mobile_money']);
    expect(view.showSchedule).toBe(false);
  });

  it('offers only diaspora pay-now even when a wallet balance exists', () => {
    const view = buildCheckoutPresentation(
      {
        checkout_method: 'STRIPE',
        groups: [{ ...group, allowed_payment_timings: [...group.allowed_payment_timings] }],
        can_pay_with_wallet: true,
        diaspora: { is_diaspora: true },
        schedule_allowed: true,
      },
      'delivery'
    );
    expect(view.payments).toEqual(['diaspora']);
    expect(view.showSchedule).toBe(true);
  });
});

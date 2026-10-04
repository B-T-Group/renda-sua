import { buildCheckoutPresentation } from './checkoutPresentation';
import type { ResolvedCheckoutConfig } from '../types/checkout';

function preflight(overrides: Partial<ResolvedCheckoutConfig> = {}): ResolvedCheckoutConfig {
  return {
    success: true,
    can_proceed: true,
    blocking_errors: [],
    checkout_method: 'MOBILE_MONEY',
    verification_method: 'PHONE',
    groups: [
      {
        business_id: 'b1',
        currency: 'XAF',
        payment_rail: 'mobile_money',
        allowed_payment_timings: ['pay_now', 'pay_at_delivery', 'pay_at_pickup'],
        requires_payment_phone: true,
        seller_country: 'CM',
        subtotal: 1000,
        total: 1500,
        items: [],
        pickup_eligible: true,
        shipping_eligible: false,
      },
    ],
    requires_address_for_payment: false,
    requires_payment_phone: true,
    delivery_availability: { available: true, estimated_delivery_minutes: 45 },
    momo_pay_now_delivery_enabled: false,
    ...overrides,
  };
}

describe('buildCheckoutPresentation', () => {
  it('hides pay-now Mobile Money on delivery when that rail is off', () => {
    const view = buildCheckoutPresentation(preflight(), 'delivery');
    expect(view.fulfillment).toEqual(['pickup', 'delivery']);
    expect(view.payments).toEqual(['pay_at_delivery']);
    expect(view.payments).not.toContain('mobile_money');
  });

  it('offers the wallet when the balance covers the order', () => {
    const view = buildCheckoutPresentation(
      preflight({ can_pay_with_wallet: true, checkout_method: 'STRIPE' }),
      'delivery'
    );
    expect(view.payments[0]).toBe('wallet');
    expect(view.payments).toContain('card');
  });

  it('collapses pay-after-confirm to a single choice and skips the deposit', () => {
    const view = buildCheckoutPresentation(
      preflight({ pay_after_merchant_confirm_eligible: true, deposit_required: true, deposit_amount: 500 }),
      'delivery'
    );
    expect(view.payments).toEqual(['pay_after_confirm']);
  });

  it('shows only diaspora pay-now for a cross-border order', () => {
    const view = buildCheckoutPresentation(
      preflight({ diaspora: { is_diaspora: true }, checkout_method: 'STRIPE' }),
      'delivery'
    );
    expect(view.payments).toEqual(['diaspora']);
  });

  it('shows scheduling only when the order allows it and is not pickup', () => {
    expect(buildCheckoutPresentation(preflight({ schedule_allowed: true }), 'delivery').showSchedule).toBe(true);
    expect(buildCheckoutPresentation(preflight({ schedule_allowed: true }), 'pickup').showSchedule).toBe(false);
  });
});

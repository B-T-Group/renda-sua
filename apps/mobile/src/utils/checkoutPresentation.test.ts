import {
  buildCheckoutPresentation,
  isCoveredDeliveryWindow,
  resolveDeliveryCoverage,
} from './checkoutPresentation';
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

describe('#594 dedicated-covered delivery slots', () => {
  const afternoon = {
    date: '2026-10-21',
    slot_id: 'slot-pm',
    slot_key: 'afternoon',
    start: '12:00',
    end: '16:00',
    pickup_time: '12:30',
  };
  const tomorrowMorning = { ...afternoon, date: '2026-10-22', slot_id: 'slot-am', slot_key: 'morning', start: '08:00', end: '12:00' };

  it('flag off (fields absent): unchanged, unavailable delivery is dropped', () => {
    const view = buildCheckoutPresentation(
      preflight({ delivery_availability: { available: false, estimated_delivery_minutes: null } }),
      'delivery'
    );
    expect(view.fulfillment).toEqual(['pickup']);
    expect(view.deliveryScheduledOnly).toBe(false);
  });

  it('flag on, ASAP available: covered slots are ignored', () => {
    const availability = {
      available: true,
      estimated_delivery_minutes: 30,
      delivery_asap_available: true,
      dedicated_covered_slots: [afternoon],
    };
    expect(resolveDeliveryCoverage(availability)).toEqual({ scheduledOnly: false, coveredSlots: [] });
    expect(buildCheckoutPresentation(preflight({ delivery_availability: availability }), 'delivery').deliveryScheduledOnly).toBe(false);
  });

  it('flag on, no nearby agent, Afternoon covered: delivery shown, scheduled-only, covered slots only', () => {
    const availability = {
      available: false,
      estimated_delivery_minutes: null,
      delivery_asap_available: false,
      dedicated_covered_slots: [tomorrowMorning, afternoon],
    };
    const view = buildCheckoutPresentation(
      preflight({ delivery_availability: availability, schedule_allowed: true }),
      'delivery'
    );
    expect(view.fulfillment).toEqual(['pickup', 'delivery']);
    expect(view.deliveryScheduledOnly).toBe(true);
    expect(view.showSchedule).toBe(true);
    expect(resolveDeliveryCoverage(availability).coveredSlots.map((s) => s.slot_id)).toEqual(['slot-pm', 'slot-am']);
  });

  it('flag on, nothing covered: delivery stays unavailable', () => {
    const view = buildCheckoutPresentation(
      preflight({
        delivery_availability: {
          available: false,
          estimated_delivery_minutes: null,
          delivery_asap_available: false,
          dedicated_covered_slots: [],
        },
      }),
      'delivery'
    );
    expect(view.fulfillment).toEqual(['pickup']);
    expect(view.deliveryScheduledOnly).toBe(false);
  });

  it('only a covered (date, slot_id) pair counts as a valid window', () => {
    expect(isCoveredDeliveryWindow({ slot_id: 'slot-pm', preferred_date: '2026-10-21' }, [afternoon])).toBe(true);
    expect(isCoveredDeliveryWindow({ slot_id: 'slot-pm', preferred_date: '2026-10-22' }, [afternoon])).toBe(false);
    expect(isCoveredDeliveryWindow(null, [afternoon])).toBe(false);
  });
});

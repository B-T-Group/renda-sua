import {
  buildCheckoutPresentation,
  isCoveredDeliveryWindow,
  isDeliveryUnavailableError,
  resolveDeliveryCoverage,
} from './checkoutPresentation';

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
      deliveryScheduledOnly: false,
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

describe('#594 dedicated-covered delivery slots', () => {
  const afternoon = {
    date: '2026-10-21',
    slot_id: 'slot-pm',
    slot_key: 'afternoon',
    start: '12:00',
    end: '16:00',
    pickup_time: '12:30',
  };
  const morningLater = { ...afternoon, date: '2026-10-22', slot_id: 'slot-am', slot_key: 'morning', start: '08:00', end: '12:00' };
  const base = {
    checkout_method: 'MOBILE_MONEY' as const,
    groups: [{ ...group, pickup_eligible: true, allowed_payment_timings: [...group.allowed_payment_timings] }],
    schedule_allowed: true,
  };

  it('flag off (fields absent): unchanged; unavailable delivery is dropped', () => {
    const view = buildCheckoutPresentation(
      { ...base, delivery_availability: { available: false } },
      'delivery'
    );
    expect(view.fulfillment).toEqual(['pickup']);
    expect(view.deliveryScheduledOnly).toBe(false);
    expect(resolveDeliveryCoverage({ available: false })).toEqual({
      scheduledOnly: false,
      coveredSlots: [],
    });
  });

  it('flag on, ASAP available: covered slots are ignored and ASAP stays', () => {
    const availability = {
      available: true,
      delivery_asap_available: true,
      dedicated_covered_slots: [afternoon],
    };
    const view = buildCheckoutPresentation({ ...base, delivery_availability: availability }, 'delivery');
    expect(view.fulfillment).toContain('delivery');
    expect(view.deliveryScheduledOnly).toBe(false);
    expect(resolveDeliveryCoverage(availability).scheduledOnly).toBe(false);
  });

  it('flag on, no nearby agent, Afternoon covered: delivery is offered scheduled-only', () => {
    const availability = {
      available: false,
      delivery_asap_available: false,
      dedicated_covered_slots: [morningLater, afternoon],
    };
    const view = buildCheckoutPresentation({ ...base, delivery_availability: availability }, 'delivery');
    expect(view.fulfillment).toEqual(['pickup', 'delivery']);
    expect(view.deliveryScheduledOnly).toBe(true);
    expect(view.showSchedule).toBe(true);
    // Sorted by date then start time.
    expect(resolveDeliveryCoverage(availability).coveredSlots.map((s) => s.slot_id)).toEqual([
      'slot-pm',
      'slot-am',
    ]);
    // Pickup itself is never scheduled-only.
    expect(
      buildCheckoutPresentation({ ...base, delivery_availability: availability }, 'pickup')
        .deliveryScheduledOnly
    ).toBe(false);
  });

  it('flag on, nothing covered: delivery stays unavailable (pickup suggested)', () => {
    const view = buildCheckoutPresentation(
      {
        ...base,
        delivery_availability: {
          available: false,
          delivery_asap_available: false,
          dedicated_covered_slots: [],
        },
      },
      'delivery'
    );
    expect(view.fulfillment).toEqual(['pickup']);
    expect(view.deliveryScheduledOnly).toBe(false);
  });

  it('only accepts a covered (date, slot_id) pair as the delivery window', () => {
    const slots = [afternoon];
    expect(isCoveredDeliveryWindow({ slot_id: 'slot-pm', preferred_date: '2026-10-21' }, slots)).toBe(true);
    expect(isCoveredDeliveryWindow({ slot_id: 'slot-pm', preferred_date: '2026-10-22' }, slots)).toBe(false);
    expect(isCoveredDeliveryWindow({ slot_id: 'other', preferred_date: '2026-10-21' }, slots)).toBe(false);
    expect(isCoveredDeliveryWindow(null, slots)).toBe(false);
  });

  it('ignores malformed slot entries', () => {
    const coverage = resolveDeliveryCoverage({
      available: false,
      dedicated_covered_slots: [{ ...afternoon, slot_id: '' }],
    });
    expect(coverage.scheduledOnly).toBe(false);
  });

  it('recognises DELIVERY_UNAVAILABLE create errors', () => {
    expect(isDeliveryUnavailableError({ response: { data: { error: 'DELIVERY_UNAVAILABLE' } } })).toBe(true);
    expect(isDeliveryUnavailableError({ response: { data: { code: 'DELIVERY_UNAVAILABLE' } } })).toBe(true);
    expect(isDeliveryUnavailableError({ response: { data: { error: 'OTHER' } } })).toBe(false);
    expect(isDeliveryUnavailableError(new Error('x'))).toBe(false);
    expect(isDeliveryUnavailableError(null)).toBe(false);
  });
});

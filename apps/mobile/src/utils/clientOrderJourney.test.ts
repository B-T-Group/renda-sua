import { describe, expect, it } from 'vitest';
import { getClientOrderJourney } from './clientOrderJourney';
import type { Order } from '../types/agent';

function order(overrides: Record<string, unknown>): Order {
  return {
    id: 'o1',
    order_number: '1',
    current_status: 'confirmed',
    fulfillment_method: 'delivery',
    ...overrides,
  } as unknown as Order;
}

const flaggedGoods = {
  pay_after_merchant_confirm: true,
  is_cooked_food_pickup: false,
  payment_timing: 'pay_at_delivery',
  payment_method: 'mobile_money',
  fulfillment_timing: 'asap',
  order_items: [{ is_cooked_food: false }],
};

describe('getClientOrderJourney flagged-location goods (pay-after)', () => {
  it('keeps the delivery PIN for flagged delivery orders even with pay_at_delivery timing', () => {
    const journey = getClientOrderJourney(
      order({ ...flaggedGoods, current_status: 'out_for_delivery' })
    );
    expect(journey.showPinHint).toBe(true);
  });

  it('does not use the classic pay-at-delivery (no PIN) path', () => {
    const classic = getClientOrderJourney(
      order({
        pay_after_merchant_confirm: false,
        payment_timing: 'pay_at_delivery',
        current_status: 'out_for_delivery',
      })
    );
    expect(classic.showPinHint).toBe(false);
  });

  it('shows a confirmed stage for a confirmed flagged order (payment prompt is on the summary card)', () => {
    const journey = getClientOrderJourney(
      order({ ...flaggedGoods, current_status: 'confirmed', payment_status: 'pending' })
    );
    expect(journey.stageId).toBe('confirmed');
  });

  it('shows the pickup-ready journey for flagged pickup orders', () => {
    const journey = getClientOrderJourney(
      order({
        ...flaggedGoods,
        fulfillment_method: 'pickup',
        current_status: 'ready_for_pickup',
        payment_status: 'paid',
      })
    );
    expect(journey.illustrationId).toBe('pickupReady');
  });
});

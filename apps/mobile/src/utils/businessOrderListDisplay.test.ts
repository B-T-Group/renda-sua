import { describe, expect, it } from 'vitest';
import {
  businessOrderItemTitle,
  businessOrderUnitsCount,
  formatOrderTimeWindowLabel,
  isStorePickupOrder,
  resolveOrderTimeWindow,
} from './businessOrderListDisplay';
import type { BusinessOrder } from '../types/business/orders';

function order(partial: Partial<BusinessOrder>): BusinessOrder {
  return {
    id: '1',
    order_number: '100',
    client_id: 'c',
    business_id: 'b',
    business_location_id: 'l',
    delivery_address_id: 'a',
    tax_amount: 0,
    currency: 'XAF',
    current_status: 'pending',
    requires_fast_delivery: false,
    ...partial,
  } as BusinessOrder;
}

describe('businessOrderListDisplay', () => {
  it('summarizes multi-item titles', () => {
    expect(
      businessOrderItemTitle(
        order({
          order_items: [
            { id: '1', quantity: 3, item_name: 'Pepperoni' } as never,
            { id: '2', quantity: 1, item_name: 'Turkey' } as never,
          ],
        })
      )
    ).toBe('Pepperoni ×3 +1');
  });

  it('sums units across lines', () => {
    expect(
      businessOrderUnitsCount(
        order({
          order_items: [
            { id: '1', quantity: 3 } as never,
            { id: '2', quantity: 2 } as never,
          ],
        })
      )
    ).toBe(5);
  });

  it('detects store pickup', () => {
    expect(isStorePickupOrder(order({ fulfillment_method: 'pickup' }))).toBe(true);
    expect(
      isStorePickupOrder(
        order({ fulfillment_method: 'delivery', payment_timing: 'pay_at_pickup' })
      )
    ).toBe(true);
    expect(isStorePickupOrder(order({ fulfillment_method: 'delivery' }))).toBe(false);
  });

  it('prefers linked delivery window', () => {
    const o = order({
      delivery_time_window_id: 'w2',
      delivery_time_windows: [
        { id: 'w1', preferred_date: '2026-07-01', time_slot_start: '09:00', time_slot_end: '12:00' },
        { id: 'w2', preferred_date: '2026-07-02', time_slot_start: '14:00', time_slot_end: '17:00' },
      ],
    });
    expect(resolveOrderTimeWindow(o)?.id).toBe('w2');
    expect(formatOrderTimeWindowLabel(o, 'en-US')).toContain('2026');
  });
});

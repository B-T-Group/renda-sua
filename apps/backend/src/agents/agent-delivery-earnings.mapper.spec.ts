import {
  deliveryPayRates,
  groupDeliveryTrips,
  parseDeliveryPeriod,
  periodBounds,
} from './agent-delivery-earnings.mapper';
import type { DeliveryPayoutRow } from './agent-delivery-earnings.types';

describe('agent delivery earnings mapper', () => {
  it('turns the 80 percent share into amounts and hides the percent', () => {
    const pay = deliveryPayRates({
      normalBaseFee: 500,
      fastBaseFee: 1500,
      perKmFee: 100,
      basePercent: 80,
      perKmPercent: 80,
    });
    expect(pay).toEqual({ baseAmount: 400, fastBaseAmount: 1200, perKmAmount: 80 });
    expect(pay).not.toHaveProperty('basePercent');
  });

  it('omits a fast base that matches the usual base', () => {
    const pay = deliveryPayRates({
      normalBaseFee: 500,
      fastBaseFee: 500,
      perKmFee: 100,
      basePercent: 80,
      perKmPercent: 80,
    });
    expect(pay.fastBaseAmount).toBeNull();
  });

  it('bounds this month and last month in the country timezone', () => {
    const now = new Date('2026-10-12T15:00:00.000Z');
    const month = periodBounds('month', now, 'Africa/Douala');
    const last = periodBounds('last_month', now, 'Africa/Douala');
    expect(month).toEqual({
      start: '2026-09-30T23:00:00.000Z',
      end: '2026-10-31T23:00:00.000Z',
    });
    expect(last.start).toBe('2026-08-31T23:00:00.000Z');
    expect(last.end).toBe(month.start);
    expect(periodBounds('all', now, 'UTC')).toEqual({ start: null, end: null });
  });

  it('keeps last month and all, and treats any other period as this month', () => {
    expect(parseDeliveryPeriod('last_month')).toBe('last_month');
    expect(parseDeliveryPeriod('all')).toBe('all');
    expect(parseDeliveryPeriod(undefined)).toBe('month');
    expect(parseDeliveryPeriod('week')).toBe('month');
    expect(parseDeliveryPeriod('ALL')).toBe('month');
  });

  it('groups base and per-km pay for one order and ignores item sales', () => {
    const trips = groupDeliveryTrips([
      row('order-2', 'base_delivery_fee', 400, '2026-10-02T10:00:00.000Z'),
      row('order-1', 'base_delivery_fee', 400, '2026-10-11T10:00:00.000Z'),
      row('order-1', 'per_km_delivery_fee', 160, '2026-10-11T10:00:00.000Z'),
      row('order-1', 'item_sale', 50, '2026-10-11T10:00:00.000Z'),
    ]);
    expect(trips).toEqual([
      {
        orderId: 'order-1',
        orderNumber: '1001',
        deliveredAt: '2026-10-11T10:00:00.000Z',
        amount: 560,
      },
      {
        orderId: 'order-2',
        orderNumber: '1001',
        deliveredAt: '2026-10-02T10:00:00.000Z',
        amount: 400,
      },
    ]);
  });
});

function row(
  orderId: string,
  commissionType: string,
  amount: number,
  at: string
): DeliveryPayoutRow {
  return {
    orderId,
    orderNumber: '1001',
    deliveredAt: at,
    amount,
    commissionType,
    createdAt: at,
  };
}

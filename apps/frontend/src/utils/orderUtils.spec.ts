import type { OrderData } from '../hooks/useOrderById';
import {
  businessMayCancelDeferredUncollectedOrder,
  businessMayCancelOrder,
} from './orderUtils';

const buildOrder = (overrides: Partial<OrderData>): OrderData =>
  ({
    current_status: 'pending',
    payment_status: 'pending',
    payment_timing: 'pay_now',
    ...overrides,
  } as OrderData);

describe('order cancellation utilities', () => {
  describe('businessMayCancelDeferredUncollectedOrder', () => {
    it('allows deferred uncollected orders after agent handoff', () => {
      const order = buildOrder({
        current_status: 'out_for_delivery',
        payment_status: 'pending',
        payment_timing: 'pay_at_delivery',
      });

      expect(businessMayCancelDeferredUncollectedOrder(order)).toBe(true);
    });

    it('rejects deferred orders once payment has been collected', () => {
      const order = buildOrder({
        current_status: 'out_for_delivery',
        payment_status: 'paid',
        payment_timing: 'pay_at_delivery',
      });

      expect(businessMayCancelDeferredUncollectedOrder(order)).toBe(false);
    });

    it('rejects terminal deferred orders even when payment is pending', () => {
      const order = buildOrder({
        current_status: 'complete',
        payment_status: 'pending',
        payment_timing: 'pay_at_pickup',
      });

      expect(businessMayCancelDeferredUncollectedOrder(order)).toBe(false);
    });
  });

  describe('businessMayCancelOrder', () => {
    it('keeps early statuses cancellable regardless of payment timing', () => {
      const order = buildOrder({
        current_status: 'preparing',
        payment_status: 'paid',
        payment_timing: 'pay_now',
      });

      expect(businessMayCancelOrder(order)).toBe(true);
    });

    it('rejects late pay-now orders', () => {
      const order = buildOrder({
        current_status: 'out_for_delivery',
        payment_status: 'pending',
        payment_timing: 'pay_now',
      });

      expect(businessMayCancelOrder(order)).toBe(false);
    });

    it('blocks cancel for paid cooked-food pay-after while preparing', () => {
      const order = buildOrder({
        current_status: 'preparing',
        payment_status: 'paid',
        pay_after_merchant_confirm: true,
      });

      expect(businessMayCancelOrder(order)).toBe(false);
    });

    it('blocks cancel for paid cooked-food pay-after at ready for pickup', () => {
      const order = buildOrder({
        current_status: 'ready_for_pickup',
        payment_status: 'authorized',
        pay_after_merchant_confirm: true,
      });

      expect(businessMayCancelOrder(order)).toBe(false);
    });

    it('allows the store to cancel a PAID non-cooked pay-after order (client is refunded)', () => {
      for (const current_status of ['confirmed', 'preparing', 'ready_for_pickup']) {
        const order = buildOrder({
          current_status,
          payment_status: 'paid',
          pay_after_merchant_confirm: true,
          order_items: [{ is_cooked_food: false }],
        } as any);
        expect(businessMayCancelOrder(order)).toBe(current_status !== 'ready_for_pickup');
      }
    });

    it('allows cancel for unpaid cooked-food pay-after while confirmed', () => {
      const order = buildOrder({
        current_status: 'confirmed',
        payment_status: 'pending',
        pay_after_merchant_confirm: true,
      });

      expect(businessMayCancelOrder(order)).toBe(true);
    });
  });
});

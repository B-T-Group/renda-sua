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
  });
});

import { describe, expect, it } from 'vitest';
import {
  getBusinessOrderActions,
} from './businessOrderActions';
import type { BusinessOrder } from '../types/business/orders';

function baseOrder(overrides: Partial<BusinessOrder> = {}): BusinessOrder {
  return {
    id: 'o1',
    order_number: '1',
    current_status: 'pending',
    ...overrides,
  } as BusinessOrder;
}

describe('getBusinessOrderActions delegate mode', () => {
  it('hides owner-only actions for delegates', () => {
    const delivered = getBusinessOrderActions(baseOrder({ current_status: 'delivered' }), {
      mode: 'delegate',
    });
    expect(delivered.find((a) => a.id === 'completeOrder')).toBeUndefined();

    const refund = getBusinessOrderActions(
      baseOrder({ current_status: 'refund_requested' }),
      { mode: 'delegate' }
    );
    expect(refund.find((a) => a.id === 'manageRefunds')).toBeUndefined();

    const out = getBusinessOrderActions(
      baseOrder({ current_status: 'out_for_delivery' }),
      { mode: 'delegate' }
    );
    expect(out.find((a) => a.id === 'generateOverwriteCode')).toBeUndefined();
  });

  it('keeps confirm/cancel for pending in delegate mode', () => {
    const actions = getBusinessOrderActions(baseOrder({ current_status: 'pending' }), {
      mode: 'delegate',
    });
    expect(actions.map((a) => a.id)).toEqual(['confirm', 'cancel']);
  });
});

describe('getBusinessOrderActions shipping', () => {
  it('confirms pending shipping orders', () => {
    const actions = getBusinessOrderActions(
      baseOrder({ current_status: 'pending', fulfillment_method: 'shipping' })
    );
    expect(actions.map((a) => a.id)).toEqual(['confirm', 'cancel']);
  });

  it('marks confirmed shipping orders as shipped, not ready', () => {
    const actions = getBusinessOrderActions(
      baseOrder({ current_status: 'confirmed', fulfillment_method: 'shipping' })
    );
    expect(actions.map((a) => a.id)).toContain('markShipped');
    expect(actions.find((a) => a.id === 'completePreparation')).toBeUndefined();
    expect(actions.find((a) => a.id === 'printLabel')).toBeUndefined();
  });

  it('marks preparing shipping orders as shipped', () => {
    const actions = getBusinessOrderActions(
      baseOrder({ current_status: 'preparing', fulfillment_method: 'shipping' })
    );
    expect(actions.map((a) => a.id)).toContain('markShipped');
  });

  it('offers tracking updates after ship', () => {
    const actions = getBusinessOrderActions(
      baseOrder({ current_status: 'shipped', fulfillment_method: 'shipping' })
    );
    expect(actions.map((a) => a.id)).toEqual(['updateTracking']);
  });
});

describe('getBusinessOrderActions pickup payment', () => {
  it('lets the store request payment after a failed pickup attempt', () => {
    const actions = getBusinessOrderActions(
      baseOrder({
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        payment_timing: 'pay_at_pickup',
        payment_status: 'failed',
      })
    );
    expect(actions.map((a) => a.id)).toContain('requestPickupPayment');
  });
});

import { describe, expect, it } from 'vitest';
import type { Order } from '../types/agent';
import { buildClientHomeOrderCardModel } from './buildClientHomeOrderCardModel';

function order(partial: Partial<Order>): Order {
  return {
    id: '1',
    order_number: 'ORD-1',
    client_id: 'c',
    business_id: 'b',
    business_location_id: 'l',
    delivery_address_id: 'a',
    tax_amount: 0,
    currency: 'XAF',
    current_status: 'pending',
    requires_fast_delivery: false,
    ...partial,
  } as Order;
}

describe('buildClientHomeOrderCardModel', () => {
  it('uses pay CTA for pending payment', () => {
    const model = buildClientHomeOrderCardModel(
      order({ current_status: 'pending_payment' })
    );
    expect(model.primaryActionId).toBe('pay');
    expect(model.ctaDefault).toMatch(/payment/i);
    expect(model.urgency).toBe('warning');
  });

  it('uses send PIN for ready store pickup when authorized', () => {
    const model = buildClientHomeOrderCardModel(
      order({
        fulfillment_method: 'pickup',
        current_status: 'ready_for_pickup',
        payment_timing: 'pay_now',
        payment_status: 'authorized',
      })
    );
    expect(model.primaryActionId).toBe('send_pin');
    expect(model.ctaDefault).toMatch(/PIN/i);
  });

  it('explains the in-store payment request for pay-at-pickup', () => {
    const model = buildClientHomeOrderCardModel(
      order({
        fulfillment_method: 'pickup',
        current_status: 'ready_for_pickup',
        payment_timing: 'pay_at_pickup',
        payment_status: 'pending',
      })
    );
    expect(model.subtitleKey).toBe(
      'client.orderJourney.readyPickup.nextPayAtPickup'
    );
    expect(model.subtitleDefault).toMatch(/tap Pay/i);
    expect(model.primaryActionId).toBe('pay');
    expect(model.ctaDefault).toBe('Pay now');
  });

  it('uses track CTA for in-transit delivery', () => {
    const model = buildClientHomeOrderCardModel(
      order({
        current_status: 'in_transit',
        assigned_agent_id: 'ag',
        payment_timing: 'pay_now',
      })
    );
    expect(model.primaryActionId).toBe('none');
    expect(model.ctaKey).toBe('client.home.liveOrders.ctaTrack');
    expect(model.ctaDefault).toBe('Track order');
  });
});

import { describe, expect, it } from 'vitest';
import {
  clientCanConfirmReceipt,
  clientShowDeliveryPin,
  clientShowNoAgentOptions,
} from './clientOrderActions';
import type { Order } from '../types/agent';

function order(partial: Partial<Order>): Order {
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
  } as Order;
}

describe('clientShowDeliveryPin', () => {
  it('shows PIN for delivery in transit statuses', () => {
    expect(
      clientShowDeliveryPin(order({ current_status: 'out_for_delivery', payment_timing: 'pay_now' }))
    ).toBe(true);
  });

  it('hides PIN for pay_at_delivery', () => {
    expect(
      clientShowDeliveryPin(
        order({ current_status: 'out_for_delivery', payment_timing: 'pay_at_delivery' })
      )
    ).toBe(false);
  });

  it('shows PIN for Stripe store pickup when ready', () => {
    expect(
      clientShowDeliveryPin(
        order({
          fulfillment_method: 'pickup',
          current_status: 'ready_for_pickup',
          payment_timing: 'pay_now',
          payment_status: 'authorized',
        })
      )
    ).toBe(true);
  });

  it('hides PIN for MoMo pay_at_pickup', () => {
    expect(
      clientShowDeliveryPin(
        order({
          fulfillment_method: 'pickup',
          current_status: 'ready_for_pickup',
          payment_timing: 'pay_at_pickup',
          payment_status: 'pending',
        })
      )
    ).toBe(false);
  });

  it('hides PIN for store pickup before ready', () => {
    expect(
      clientShowDeliveryPin(
        order({
          fulfillment_method: 'pickup',
          current_status: 'confirmed',
          payment_timing: 'pay_now',
          payment_status: 'authorized',
        })
      )
    ).toBe(false);
  });

  it('hides PIN for carrier shipping', () => {
    expect(
      clientShowDeliveryPin(
        order({
          fulfillment_method: 'shipping',
          current_status: 'shipped',
          payment_timing: 'pay_now',
        })
      )
    ).toBe(false);
  });
});

describe('clientShowNoAgentOptions', () => {
  it('shows options when dispatch is exhausted and no agent is assigned', () => {
    expect(
      clientShowNoAgentOptions(
        order({
          current_status: 'ready_for_pickup',
          dispatch_exhausted_at: '2026-08-01T12:00:00Z',
        })
      )
    ).toBe(true);
  });

  it('hides options when dispatch was never exhausted', () => {
    expect(
      clientShowNoAgentOptions(order({ current_status: 'ready_for_pickup' }))
    ).toBe(false);
  });

  it('hides options once an agent is assigned', () => {
    expect(
      clientShowNoAgentOptions(
        order({
          current_status: 'ready_for_pickup',
          dispatch_exhausted_at: '2026-08-01T12:00:00Z',
          assigned_agent_id: 'agent-1',
        })
      )
    ).toBe(false);
  });

  it('hides options for pickup orders', () => {
    expect(
      clientShowNoAgentOptions(
        order({
          current_status: 'ready_for_pickup',
          dispatch_exhausted_at: '2026-08-01T12:00:00Z',
          fulfillment_method: 'pickup',
        })
      )
    ).toBe(false);
  });

  it('hides options for carrier shipping', () => {
    expect(
      clientShowNoAgentOptions(
        order({
          current_status: 'ready_for_pickup',
          dispatch_exhausted_at: '2026-08-01T12:00:00Z',
          fulfillment_method: 'shipping',
        })
      )
    ).toBe(false);
  });

  it('hides options outside ready_for_pickup', () => {
    expect(
      clientShowNoAgentOptions(
        order({
          current_status: 'picked_up',
          dispatch_exhausted_at: '2026-08-01T12:00:00Z',
        })
      )
    ).toBe(false);
  });
});

describe('clientCanConfirmReceipt', () => {
  it('is available after the seller ships', () => {
    expect(
      clientCanConfirmReceipt(
        order({ fulfillment_method: 'shipping', current_status: 'shipped' })
      )
    ).toBe(true);
  });

  it('is hidden for delivery orders', () => {
    expect(
      clientCanConfirmReceipt(
        order({ fulfillment_method: 'delivery', current_status: 'shipped' })
      )
    ).toBe(false);
  });
});

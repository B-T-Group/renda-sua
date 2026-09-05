import {
  CLIENT_HOME_ORDERS_CAP,
  clientHomeOrderRank,
  selectClientHomeOrders,
} from './selectClientHomeOrders';
import type { Order } from '../hooks/useOrders';

function order(partial: Partial<Order> & { id: string }): Order {
  return {
    order_number: partial.order_number ?? partial.id,
    client_id: 'c',
    business_id: 'b',
    business_location_id: 'l',
    delivery_address_id: 'a',
    tax_amount: 0,
    service_fee: 0,
    delivery_fee: 0,
    tip_amount: 0,
    total_amount: 0,
    currency: 'XAF',
    current_status: 'pending',
    requires_fast_delivery: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  } as Order;
}

describe('selectClientHomeOrders', () => {
  it('excludes terminal orders', () => {
    const result = selectClientHomeOrders([
      order({ id: '1', current_status: 'delivered' }),
      order({ id: '2', current_status: 'cancelled' }),
      order({ id: '3', current_status: 'complete' }),
      order({ id: '4', current_status: 'preparing' }),
    ]);
    expect(result.totalActive).toBe(1);
    expect(result.selected.map((o) => o.id)).toEqual(['4']);
  });

  it('ranks needs-client before in-motion before waiting', () => {
    const preparing = order({
      id: 'prep',
      current_status: 'preparing',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    const inTransit = order({
      id: 'transit',
      current_status: 'in_transit',
      assigned_agent_id: 'ag',
      payment_timing: 'pay_now',
      created_at: '2026-01-02T00:00:00.000Z',
    });
    const pay = order({
      id: 'pay',
      current_status: 'pending_payment',
      created_at: '2026-01-03T00:00:00.000Z',
    });
    expect(clientHomeOrderRank(pay)).toBe(0);
    expect(clientHomeOrderRank(inTransit)).toBe(1);
    expect(clientHomeOrderRank(preparing)).toBe(2);

    const result = selectClientHomeOrders([preparing, inTransit, pay]);
    expect(result.selected.map((o) => o.id)).toEqual(['pay', 'transit']);
    expect(result.totalActive).toBe(3);
  });

  it('caps at CLIENT_HOME_ORDERS_CAP', () => {
    const orders = [
      order({ id: 'a', current_status: 'pending_payment' }),
      order({
        id: 'b',
        current_status: 'out_for_delivery',
        assigned_agent_id: 'ag',
        payment_timing: 'pay_now',
      }),
      order({ id: 'c', current_status: 'preparing' }),
    ];
    const result = selectClientHomeOrders(orders);
    expect(result.selected).toHaveLength(CLIENT_HOME_ORDERS_CAP);
    expect(result.totalActive).toBe(3);
  });
});

import type { Order, OrderItem } from '../types/agent';
import { selectBuyAgainOrder } from './selectBuyAgainOrder';

function line(name: string, cooked: boolean): OrderItem {
  return { id: name, quantity: 1, item_name: name, is_cooked_food: cooked };
}

function order(id: string, status: string, items: OrderItem[]): Order {
  return { id, current_status: status, order_items: items } as Order;
}

describe('selectBuyAgainOrder', () => {
  const grocery = order('groc', 'complete', [line('Rice', false)]);
  const meal = order('meal', 'delivered', [line('Ndolé', true), line('Soap', false)]);
  const open = order('open', 'preparing', [line('Eru', true)]);

  it('uses the newest completed order on shop', () => {
    const picked = selectBuyAgainOrder([grocery, meal], false);
    expect(picked?.order.id).toBe('groc');
    expect(picked?.lines).toHaveLength(1);
  });

  it('on restaurants skips non-food orders and keeps only dishes', () => {
    const picked = selectBuyAgainOrder([open, grocery, meal], true);
    expect(picked?.order.id).toBe('meal');
    expect(picked?.lines.map((item) => item.item_name)).toEqual(['Ndolé']);
  });

  it('hides buy again on restaurants when nothing cooked was bought', () => {
    expect(selectBuyAgainOrder([grocery], true)).toBeNull();
  });
});

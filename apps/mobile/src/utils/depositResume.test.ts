import type { Order } from '../types/agent';
import { remainingAfterDeposit } from './depositResume';

function order(partial: Partial<Order>): Order {
  return { id: 'o1', currency: 'XAF', ...partial } as Order;
}

describe('remainingAfterDeposit', () => {
  it('prefers server amount_due', () => {
    expect(
      remainingAfterDeposit(
        order({ amount_due: 8500, total_amount: 10000, deposit_amount: 1500 })
      )
    ).toBe(8500);
  });

  it('falls back to total_amount minus deposit', () => {
    expect(
      remainingAfterDeposit(order({ total_amount: 10000, deposit_amount: 1500 }))
    ).toBe(8500);
  });
});

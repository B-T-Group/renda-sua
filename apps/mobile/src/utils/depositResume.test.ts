import type { Order } from '../types/agent';
import {
  remainingAfterDeposit,
  resolveAmountDueAfterDeposit,
} from './depositResume';

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

  it('clamps remainder at zero', () => {
    expect(
      remainingAfterDeposit(order({ total_amount: 100, deposit_amount: 150 }))
    ).toBe(0);
  });
});

describe('resolveAmountDueAfterDeposit', () => {
  it('returns null when total_amount is missing and amount_due is absent', () => {
    expect(
      resolveAmountDueAfterDeposit(order({ deposit_amount: 150, deposit_status: 'paid' }))
    ).toBeNull();
  });

  it('uses amount_due when total_amount was stripped for agents', () => {
    expect(
      resolveAmountDueAfterDeposit(
        order({ amount_due: 50, deposit_amount: 150, deposit_status: 'paid' })
      )
    ).toBe(50);
  });
});

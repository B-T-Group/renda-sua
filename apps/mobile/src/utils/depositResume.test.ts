import type { Order } from '../types/agent';
import {
  isDepositPending,
  remainingAfterDeposit,
  resolveAmountDueAfterDeposit,
} from './depositResume';

function order(partial: Partial<Order>): Order {
  return { id: 'o1', currency: 'XAF', ...partial } as Order;
}

describe('isDepositPending', () => {
  it('is true for pending deposit on pending_payment order', () => {
    expect(
      isDepositPending(
        order({
          current_status: 'pending_payment',
          deposit_status: 'pending',
          deposit_amount: 150,
        })
      )
    ).toBe(true);
  });

  it('is true for failed deposit so Pay now retries deposit not pickup', () => {
    expect(
      isDepositPending(
        order({
          current_status: 'pending_payment',
          deposit_status: 'failed',
          deposit_amount: 150,
          payment_timing: 'pay_at_pickup',
        })
      )
    ).toBe(true);
  });

  it('is false once deposit is paid', () => {
    expect(
      isDepositPending(
        order({
          current_status: 'pending_payment',
          deposit_status: 'paid',
          deposit_amount: 150,
        })
      )
    ).toBe(false);
  });
});

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

import type { Order } from '../types/agent';
import {
  hasLivePendingDepositTx,
  isDepositPending,
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

describe('isDepositPending', () => {
  it('is true only for pending_payment + pending deposit with amount or txn', () => {
    expect(
      isDepositPending(
        order({
          current_status: 'pending_payment',
          deposit_status: 'pending',
          deposit_amount: 150,
        })
      )
    ).toBe(true);
    expect(
      isDepositPending(
        order({
          current_status: 'pending_payment',
          deposit_status: 'pending',
          deposit_mobile_payment_transaction_id: 'txn-1',
        })
      )
    ).toBe(true);
  });

  it('is false after capture, on failed deposit, or once the order leaves pending_payment', () => {
    expect(
      isDepositPending(
        order({
          current_status: 'pending_payment',
          deposit_status: 'paid',
          deposit_amount: 150,
        })
      )
    ).toBe(false);
    expect(
      isDepositPending(
        order({
          current_status: 'confirmed',
          deposit_status: 'pending',
          deposit_amount: 150,
        })
      )
    ).toBe(false);
    expect(
      isDepositPending(
        order({
          current_status: 'pending_payment',
          deposit_status: 'pending',
          deposit_amount: 0,
        })
      )
    ).toBe(false);
  });
});

describe('hasLivePendingDepositTx', () => {
  it('requires both pending status and a stored transaction id', () => {
    expect(
      hasLivePendingDepositTx(
        order({
          deposit_status: 'pending',
          deposit_mobile_payment_transaction_id: 'txn-1',
        })
      )
    ).toBe(true);
    expect(
      hasLivePendingDepositTx(
        order({ deposit_status: 'pending', deposit_amount: 150 })
      )
    ).toBe(false);
    expect(
      hasLivePendingDepositTx(
        order({
          deposit_status: 'paid',
          deposit_mobile_payment_transaction_id: 'txn-1',
        })
      )
    ).toBe(false);
  });
});

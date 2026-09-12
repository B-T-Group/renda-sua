import { moneySummary } from './helpers';
import type { OrderLike } from './types';

function order(overrides: Partial<OrderLike> = {}): OrderLike {
  return {
    id: 'o1',
    order_number: 'RS-1',
    current_status: 'confirmed',
    currency: 'XAF',
    total_amount: 10000,
    subtotal: 8500,
    tax_amount: 0,
    ...overrides,
  };
}

describe('moneySummary deposit remainder', () => {
  it('prefers server amount_due when present', () => {
    const summary = moneySummary(
      order({
        deposit_amount: 1500,
        deposit_status: 'paid',
        amount_due: 8000,
      })
    );
    expect(summary.amountDue).toBe(8000);
    expect(summary.depositAmount).toBe(1500);
  });

  it('computes remainder from total minus paid deposit', () => {
    const summary = moneySummary(
      order({ deposit_amount: 1500, deposit_status: 'paid' })
    );
    expect(summary.amountDue).toBe(8500);
  });

  it('does not invent amountDue before the deposit is paid', () => {
    const summary = moneySummary(
      order({ deposit_amount: 1500, deposit_status: 'pending' })
    );
    expect(summary.amountDue).toBeNull();
    expect(summary.depositAmount).toBe(1500);
  });
});

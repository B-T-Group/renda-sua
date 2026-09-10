import {
  isDepositPaid,
  remainingAfterDeposit,
} from './depositRemainder';

describe('depositRemainder', () => {
  it('prefers server amount_due', () => {
    expect(
      remainingAfterDeposit({
        total_amount: 1000,
        deposit_amount: 150,
        deposit_status: 'paid',
        amount_due: 800,
      })
    ).toBe(800);
  });

  it('computes total minus deposit when paid', () => {
    expect(
      remainingAfterDeposit({
        total_amount: 1000,
        deposit_amount: 150,
        deposit_status: 'paid',
      })
    ).toBe(850);
  });

  it('returns full total when deposit not paid', () => {
    expect(
      remainingAfterDeposit({
        total_amount: 1000,
        deposit_amount: 150,
        deposit_status: 'pending',
      })
    ).toBe(1000);
  });

  it('detects paid deposit', () => {
    expect(
      isDepositPaid({ deposit_amount: 150, deposit_status: 'paid' })
    ).toBe(true);
    expect(
      isDepositPaid({ deposit_amount: 150, deposit_status: 'pending' })
    ).toBe(false);
  });
});

import {
  hasCashExceptionBlockingDeposit,
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

  it('computes total minus deposit when the deposit was applied', () => {
    expect(
      remainingAfterDeposit({
        total_amount: 5000,
        deposit_amount: 500,
        deposit_status: 'applied',
      })
    ).toBe(4500);
    expect(
      isDepositPaid({ deposit_amount: 500, deposit_status: 'applied' })
    ).toBe(true);
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

  it('blocks cash exception for paid deposits', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 150, deposit_status: 'paid' })
    ).toBe(true);
  });

  it('blocks cash exception for applied deposits', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 150, deposit_status: 'applied' })
    ).toBe(true);
  });

  it('blocks cash exception for forfeited deposits', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 150, deposit_status: 'forfeited' })
    ).toBe(true);
  });

  it('allows cash exception for pending deposits', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 150, deposit_status: 'pending' })
    ).toBe(false);
  });

  it('allows cash exception for failed deposits', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 150, deposit_status: 'failed' })
    ).toBe(false);
  });

  it('allows cash exception for refunded deposits', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 150, deposit_status: 'refunded' })
    ).toBe(false);
  });

  it('allows cash exception when deposit amount is zero', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 0, deposit_status: 'paid' })
    ).toBe(false);
  });

  it('allows cash exception when deposit status is none', () => {
    expect(
      hasCashExceptionBlockingDeposit({ deposit_amount: 150, deposit_status: 'none' })
    ).toBe(false);
  });
});

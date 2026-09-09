import { describe, expect, it } from 'vitest';
import { resolveMomoPaymentStatuses } from './momoPaymentPoll';

describe('resolveMomoPaymentStatuses', () => {
  it('returns waiting when no orders', () => {
    expect(resolveMomoPaymentStatuses([])).toBe('waiting');
  });

  it('returns paid when all full-pay orders are paid', () => {
    expect(resolveMomoPaymentStatuses([{ payment_status: 'paid' }])).toBe('paid');
    expect(
      resolveMomoPaymentStatuses([
        { payment_status: 'paid' },
        { payment_status: 'paid' },
      ])
    ).toBe('paid');
  });

  it('returns failed when any full-pay order failed', () => {
    expect(resolveMomoPaymentStatuses([{ payment_status: 'failed' }])).toBe('failed');
    expect(
      resolveMomoPaymentStatuses([
        { payment_status: 'paid' },
        { payment_status: 'failed' },
      ])
    ).toBe('failed');
  });

  it('returns waiting when full-pay order is pending', () => {
    expect(resolveMomoPaymentStatuses([{ payment_status: 'pending' }])).toBe('waiting');
  });

  it('returns paid when all deposit orders have deposit_status=paid', () => {
    expect(
      resolveMomoPaymentStatuses([
        { deposit_amount: 151, deposit_status: 'paid', payment_status: 'pending' },
      ])
    ).toBe('paid');
    expect(
      resolveMomoPaymentStatuses([
        { deposit_amount: 151, deposit_status: 'paid', payment_status: 'pending' },
        { deposit_amount: 200, deposit_status: 'paid', payment_status: 'pending' },
      ])
    ).toBe('paid');
  });

  it('returns failed when deposit order has deposit_status=failed', () => {
    expect(
      resolveMomoPaymentStatuses([
        { deposit_amount: 151, deposit_status: 'failed', payment_status: 'pending' },
      ])
    ).toBe('failed');
  });

  it('returns waiting when deposit order has deposit_status=pending', () => {
    expect(
      resolveMomoPaymentStatuses([
        { deposit_amount: 151, deposit_status: 'pending', payment_status: 'pending' },
      ])
    ).toBe('waiting');
  });

  it('detects deposit orders by deposit_mobile_payment_transaction_id', () => {
    expect(
      resolveMomoPaymentStatuses([
        {
          deposit_mobile_payment_transaction_id: 'txn-123',
          deposit_status: 'paid',
          payment_status: 'pending',
        },
      ])
    ).toBe('paid');
  });

  it('detects deposit orders by non-null deposit_status', () => {
    expect(
      resolveMomoPaymentStatuses([
        { deposit_status: 'paid', payment_status: 'pending' },
      ])
    ).toBe('paid');
  });
});

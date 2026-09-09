import { describe, expect, it } from 'vitest';
import { resolveMomoPaymentStatuses } from './momoPaymentPoll';

describe('resolveMomoPaymentStatuses', () => {
  it('returns waiting when no orders', () => {
    expect(resolveMomoPaymentStatuses([])).toBe('waiting');
  });

  describe('full-pay MoMo orders', () => {
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

    it('BLOCKER 1 regression: full-pay with deposit_status=none succeeds on payment_status=paid', () => {
      // Hasura default deposit_status is non-null 'none' for full-pay orders
      expect(
        resolveMomoPaymentStatuses([
          { payment_status: 'paid', deposit_status: 'none' },
        ])
      ).toBe('paid');
    });
  });

  describe('deposit orders', () => {
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

    it('detects deposit orders by non-null deposit_status (not none)', () => {
      expect(
        resolveMomoPaymentStatuses([
          { deposit_status: 'paid', payment_status: 'pending' },
        ])
      ).toBe('paid');
    });

    it('BLOCKER 1: does NOT treat deposit_status=none as deposit evidence', () => {
      // deposit_status='none' alone should not classify order as deposit
      expect(
        resolveMomoPaymentStatuses([
          { deposit_status: 'none', payment_status: 'paid' },
        ])
      ).toBe('paid');
    });
  });

  describe('multi-order aggregation (BLOCKER 2)', () => {
    it('returns failed when any order failed (any-failed priority)', () => {
      // Full-pay: pending + failed → failed
      expect(
        resolveMomoPaymentStatuses([
          { payment_status: 'pending' },
          { payment_status: 'failed' },
        ])
      ).toBe('failed');
    });

    it('returns failed when deposit order fails in multi-order', () => {
      // Deposit: pending + failed → failed
      expect(
        resolveMomoPaymentStatuses([
          { deposit_amount: 151, deposit_status: 'pending', payment_status: 'pending' },
          { deposit_amount: 200, deposit_status: 'failed', payment_status: 'pending' },
        ])
      ).toBe('failed');
    });

    it('returns failed when later order fails (masks pending)', () => {
      // Ensure we check ALL orders, not just first
      expect(
        resolveMomoPaymentStatuses([
          { payment_status: 'pending' },
          { payment_status: 'pending' },
          { payment_status: 'failed' },
        ])
      ).toBe('failed');
    });

    it('returns waiting when any pending (no failures)', () => {
      expect(
        resolveMomoPaymentStatuses([
          { payment_status: 'paid' },
          { payment_status: 'pending' },
        ])
      ).toBe('waiting');
    });

    it('returns paid only when all orders succeeded', () => {
      expect(
        resolveMomoPaymentStatuses([
          { payment_status: 'paid' },
          { deposit_amount: 151, deposit_status: 'paid', payment_status: 'pending' },
        ])
      ).toBe('paid');
    });
  });
});

import {
  MOMO_POLL_TIMEOUT_MS,
  claimPollTerminalPhase,
  claimTransactionStatusFromBody,
  resolveClaimPaymentPhase,
  resolveMomoPaymentStatuses,
} from './momoPaymentPoll';

describe('resolveMomoPaymentStatuses', () => {
  it('returns waiting when empty or still pending', () => {
    expect(resolveMomoPaymentStatuses([])).toBe('waiting');
    expect(resolveMomoPaymentStatuses(['pending'])).toBe('waiting');
    expect(resolveMomoPaymentStatuses(['paid', 'pending'])).toBe('waiting');
  });

  it('returns paid when every order is paid', () => {
    expect(resolveMomoPaymentStatuses(['paid'])).toBe('paid');
    expect(resolveMomoPaymentStatuses(['paid', 'paid'])).toBe('paid');
  });

  it('maps claim hold statuses', () => {
    expect(resolveClaimPaymentPhase('success')).toBe('paid');
    expect(resolveClaimPaymentPhase('SUCCESS')).toBe('paid');
    expect(resolveClaimPaymentPhase('completed')).toBe('paid');
    expect(resolveClaimPaymentPhase('failed')).toBe('failed');
    expect(resolveClaimPaymentPhase('cancelled')).toBe('failed');
    expect(resolveClaimPaymentPhase('pending')).toBe('waiting');
    expect(resolveClaimPaymentPhase('ambiguous')).toBe('waiting');
    expect(resolveClaimPaymentPhase(null)).toBe('waiting');
    expect(resolveClaimPaymentPhase('')).toBe('waiting');
  });

  it('reads the nested transaction status and ignores a missing envelope', () => {
    expect(
      claimTransactionStatusFromBody({
        data: { status: 'success' },
        status: 'failed',
      })
    ).toBe('success');
    expect(claimTransactionStatusFromBody({ status: 'cancelled' })).toBe(
      'cancelled'
    );
    expect(
      claimTransactionStatusFromBody({
        data: { status: undefined },
        status: 'failed',
      })
    ).toBe('failed');
    expect(claimTransactionStatusFromBody(null)).toBeUndefined();
  });

  it('keeps polling an ambiguous claim until the wait window ends', () => {
    expect(claimPollTerminalPhase('waiting', 0)).toBeNull();
    expect(claimPollTerminalPhase('waiting', MOMO_POLL_TIMEOUT_MS - 1)).toBeNull();
    expect(claimPollTerminalPhase('waiting', MOMO_POLL_TIMEOUT_MS)).toBe('timeout');
    expect(claimPollTerminalPhase('paid', 0)).toBe('paid');
    expect(claimPollTerminalPhase('failed', MOMO_POLL_TIMEOUT_MS)).toBe('failed');
  });

  it('returns failed when any order failed', () => {
    expect(resolveMomoPaymentStatuses(['failed'])).toBe('failed');
    expect(resolveMomoPaymentStatuses(['paid', 'failed'])).toBe('failed');
  });
});

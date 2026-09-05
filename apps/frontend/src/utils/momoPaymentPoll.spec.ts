import { resolveMomoPaymentStatuses } from './momoPaymentPoll';

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

  it('returns failed when any order failed', () => {
    expect(resolveMomoPaymentStatuses(['failed'])).toBe('failed');
    expect(resolveMomoPaymentStatuses(['paid', 'failed'])).toBe('failed');
  });
});

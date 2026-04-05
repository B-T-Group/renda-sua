import {
  isOrderRefundRequestAllowed,
  ORDER_REFUND_WINDOW_MS,
} from './order-refund-window.util';

describe('order-refund-window.util', () => {
  const base = new Date('2026-01-10T12:00:00.000Z').getTime();

  it('allows when now is exactly at completion', () => {
    expect(isOrderRefundRequestAllowed(new Date(base).toISOString(), base)).toBe(
      true
    );
  });

  it('allows when within 3 days', () => {
    const almostEnd = base + ORDER_REFUND_WINDOW_MS - 1;
    expect(
      isOrderRefundRequestAllowed(new Date(base).toISOString(), almostEnd)
    ).toBe(true);
  });

  it('allows at exact deadline (inclusive)', () => {
    const deadline = base + ORDER_REFUND_WINDOW_MS;
    expect(
      isOrderRefundRequestAllowed(new Date(base).toISOString(), deadline)
    ).toBe(true);
  });

  it('rejects after deadline', () => {
    const after = base + ORDER_REFUND_WINDOW_MS + 1;
    expect(
      isOrderRefundRequestAllowed(new Date(base).toISOString(), after)
    ).toBe(false);
  });

  it('rejects null or empty completed_at', () => {
    expect(isOrderRefundRequestAllowed(null)).toBe(false);
    expect(isOrderRefundRequestAllowed(undefined)).toBe(false);
    expect(isOrderRefundRequestAllowed('')).toBe(false);
  });

  it('rejects invalid date string', () => {
    expect(isOrderRefundRequestAllowed('not-a-date')).toBe(false);
  });
});

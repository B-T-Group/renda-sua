import { deliveryConfirmVariant, momoReminderAt } from './delivery-confirm-state.util';

describe('deliveryConfirmVariant', () => {
  const now = new Date('2026-11-04T15:00:00Z');
  it.each([
    ['out_for_delivery', 'not_delivered_yet'],
    ['awaiting_client_confirmation', 'awaiting'],
    ['pending_auto_complete', 'awaiting'],
    ['disputed', 'disputed'],
    ['cancelled', 'closed'],
    ['failed', 'closed'],
  ])('%s → %s', (status, variant) => {
    expect(deliveryConfirmVariant({ current_status: status }, now)).toBe(variant);
  });

  it('complete inside the report window can still report', () => {
    expect(
      deliveryConfirmVariant(
        { current_status: 'complete', report_window_ends_at: '2026-11-05T00:00:00Z' },
        now
      )
    ).toBe('completed_can_report');
    expect(
      deliveryConfirmVariant(
        { current_status: 'complete', report_window_ends_at: '2026-11-04T00:00:00Z' },
        now
      )
    ).toBe('completed');
    expect(deliveryConfirmVariant({ current_status: 'complete' }, now)).toBe('completed');
  });
});

describe('momoReminderAt', () => {
  const market = { isStripeRail: false, momoAutoCompleteHours: 2, momoReminderHours: 1 };
  it('is one hour before a 2h deadline', () => {
    expect(
      momoReminderAt({ current_status: 'x', auto_complete_deadline_at: '2026-11-04T17:00:00Z' }, market)
    ).toBe('2026-11-04T16:00:00.000Z');
  });
  it('is null on Stripe or without a deadline', () => {
    expect(momoReminderAt({ current_status: 'x' }, market)).toBeNull();
    expect(
      momoReminderAt(
        { current_status: 'x', auto_complete_deadline_at: '2026-11-04T17:00:00Z' },
        { ...market, isStripeRail: true }
      )
    ).toBeNull();
  });
});

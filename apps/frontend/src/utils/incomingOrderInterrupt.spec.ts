import {
  incomingInterruptSecondsLeft,
  isActionableIncomingOrder,
  readIncomingInterruptPayload,
  resolveIncomingInterruptDeadline,
  shouldOpenIncomingInterrupt,
} from './incomingOrderInterrupt';

describe('incomingOrderInterrupt', () => {
  it('treats pending awaiting/grace as actionable and ignores scheduled', () => {
    expect(
      isActionableIncomingOrder({ current_status: 'pending' })
    ).toBe(true);
    expect(
      isActionableIncomingOrder({
        current_status: 'pending',
        acceptance_state: 'grace',
      })
    ).toBe(true);
    expect(
      isActionableIncomingOrder({
        current_status: 'pending',
        acceptance_state: 'scheduled',
      })
    ).toBe(false);
    expect(
      isActionableIncomingOrder({
        current_status: 'confirmed',
        acceptance_state: 'awaiting_acceptance',
      })
    ).toBe(false);
  });

  it('prefers grace deadline and never returns a negative countdown', () => {
    expect(
      resolveIncomingInterruptDeadline({
        grace_deadline_at: '2026-09-03T10:05:00.000Z',
        acceptance_deadline_at: '2026-09-03T10:02:00.000Z',
      })
    ).toBe('2026-09-03T10:05:00.000Z');
    const now = Date.parse('2026-09-03T10:00:00.000Z');
    expect(incomingInterruptSecondsLeft('2026-09-03T10:00:01.500Z', now)).toBe(2);
    expect(incomingInterruptSecondsLeft('2026-09-03T09:59:00.000Z', now)).toBe(0);
    expect(incomingInterruptSecondsLeft(null, now)).toBeNull();
    expect(incomingInterruptSecondsLeft('not-a-date', now)).toBeNull();
  });

  it('reads nested SW payload fields and ignores unknown events', () => {
    expect(
      readIncomingInterruptPayload({
        data: { data: { event: 'order_created', orderId: 'o1' } },
      })
    ).toEqual({ eventName: 'order_created', orderId: 'o1' });
    expect(
      readIncomingInterruptPayload({
        data: { event: 'order_acceptance_reminder', orderId: 'o2' },
      })
    ).toEqual({ eventName: 'order_acceptance_reminder', orderId: 'o2' });
    expect(shouldOpenIncomingInterrupt('order_acceptance_activate')).toBe(true);
    expect(shouldOpenIncomingInterrupt('order_status_changed')).toBe(false);
    expect(shouldOpenIncomingInterrupt(null)).toBe(false);
  });
});

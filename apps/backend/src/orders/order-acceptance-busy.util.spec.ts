import {
  buildBusySlaPatch,
  busySnoozeCutoffIso,
  extendTimestampIso,
  isDeadlineInFuture,
  remainingWaitSeconds,
} from './order-acceptance-busy.util';

describe('order-acceptance-busy.util', () => {
  const now = Date.parse('2026-08-24T21:00:00.000Z');

  it('extends a missing or past deadline to now + snooze', () => {
    expect(extendTimestampIso(null, 15 * 60_000, now)).toBe(
      '2026-08-24T21:15:00.000Z'
    );
    expect(
      extendTimestampIso('2026-08-24T20:59:00.000Z', 15 * 60_000, now)
    ).toBe('2026-08-24T21:15:00.000Z');
  });

  it('keeps a later existing deadline', () => {
    expect(
      extendTimestampIso('2026-08-24T21:30:00.000Z', 15 * 60_000, now)
    ).toBe('2026-08-24T21:30:00.000Z');
  });

  it('detects a deadline still in the future', () => {
    expect(isDeadlineInFuture('2026-08-24T21:15:00.000Z', now)).toBe(true);
    expect(isDeadlineInFuture('2026-08-24T20:59:00.000Z', now)).toBe(false);
    expect(isDeadlineInFuture(null, now)).toBe(false);
  });

  it('treats invalid or barely-future deadlines as not in the future', () => {
    expect(isDeadlineInFuture('not-a-timestamp', now)).toBe(false);
    expect(isDeadlineInFuture('2026-08-24T21:00:01.000Z', now)).toBe(false);
  });

  it('computes remaining wait seconds with a 1s floor', () => {
    expect(remainingWaitSeconds('2026-08-24T21:00:10.000Z', now)).toBe(10);
    expect(remainingWaitSeconds('2026-08-24T20:59:00.000Z', now)).toBe(1);
  });

  it('builds an awaiting_acceptance SLA patch', () => {
    const patch = buildBusySlaPatch(
      {
        acceptance_state: 'awaiting_acceptance',
        acceptance_deadline_at: '2026-08-24T21:02:00.000Z',
        grace_deadline_at: null,
      },
      15,
      now
    );
    expect(patch.acceptanceDeadlineAt).toBe('2026-08-24T21:15:00.000Z');
    expect(patch.rescheduleEvent).toBe('order.acceptance_deadline');
    expect(patch.waitSeconds).toBe(15 * 60);
    expect(patch.snoozeUntil).toBe('2026-08-24T21:15:00.000Z');
  });

  it('builds a grace SLA patch', () => {
    const patch = buildBusySlaPatch(
      {
        acceptance_state: 'grace',
        acceptance_deadline_at: '2026-08-24T20:55:00.000Z',
        grace_deadline_at: '2026-08-24T21:03:00.000Z',
      },
      15,
      now
    );
    expect(patch.graceDeadlineAt).toBe('2026-08-24T21:15:00.000Z');
    expect(patch.acceptanceDeadlineAt).toBe('2026-08-24T20:55:00.000Z');
    expect(patch.rescheduleEvent).toBe('order.acceptance_grace_deadline');
  });

  it('treats no_response as a grace-window snooze', () => {
    const patch = buildBusySlaPatch(
      {
        acceptance_state: 'no_response',
        acceptance_deadline_at: '2026-08-24T20:55:00.000Z',
        grace_deadline_at: '2026-08-24T21:01:00.000Z',
      },
      15,
      now
    );
    expect(patch.graceDeadlineAt).toBe('2026-08-24T21:15:00.000Z');
    expect(patch.rescheduleEvent).toBe('order.acceptance_grace_deadline');
  });

  it('computes the pending-acceptance snooze cutoff', () => {
    expect(busySnoozeCutoffIso(15, now)).toBe('2026-08-24T20:45:00.000Z');
  });
});

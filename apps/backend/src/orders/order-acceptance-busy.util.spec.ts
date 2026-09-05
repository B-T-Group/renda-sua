import {
  buildBusySlaPatch,
  busySnoozeCutoffIso,
  extendTimestampIso,
  isBusyInterruptSnoozed,
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

  it('computes the pending-acceptance snooze cutoff', () => {
    expect(busySnoozeCutoffIso(15, now)).toBe('2026-08-24T20:45:00.000Z');
  });

  it('snoozes a recently marked-busy awaiting_acceptance order', () => {
    expect(
      isBusyInterruptSnoozed(
        {
          acceptance_state: 'awaiting_acceptance',
          busy_extra_prep_minutes: 20,
          updated_at: '2026-08-24T20:50:00.000Z',
        },
        15,
        now
      )
    ).toBe(true);
  });

  it('shows the interrupt again after SLA escalation to grace', () => {
    expect(
      isBusyInterruptSnoozed(
        {
          acceptance_state: 'grace',
          busy_extra_prep_minutes: 20,
          updated_at: '2026-08-24T21:00:00.000Z',
        },
        15,
        now
      )
    ).toBe(false);
  });

  it('shows a no_response order even when updated_at is fresh', () => {
    expect(
      isBusyInterruptSnoozed(
        {
          acceptance_state: 'no_response',
          busy_extra_prep_minutes: 20,
          updated_at: '2026-08-24T21:00:00.000Z',
        },
        15,
        now
      )
    ).toBe(false);
  });

  it('does not snooze after the overlay window elapses', () => {
    expect(
      isBusyInterruptSnoozed(
        {
          acceptance_state: 'awaiting_acceptance',
          busy_extra_prep_minutes: 20,
          updated_at: '2026-08-24T20:44:00.000Z',
        },
        15,
        now
      )
    ).toBe(false);
  });

  it('surfaces a later grace order while an older awaiting order is snoozed', () => {
    const awaiting = {
      acceptance_state: 'awaiting_acceptance',
      busy_extra_prep_minutes: 20,
      updated_at: '2026-08-24T20:50:00.000Z',
    };
    const grace = {
      acceptance_state: 'grace',
      busy_extra_prep_minutes: 20,
      updated_at: '2026-08-24T21:00:00.000Z',
    };
    const visible = [awaiting, grace].find(
      (row) => !isBusyInterruptSnoozed(row, 15, now)
    );
    expect(visible).toBe(grace);
  });
});

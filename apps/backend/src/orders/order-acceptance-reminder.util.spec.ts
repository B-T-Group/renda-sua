import {
  ACCEPTANCE_REMINDER_INTERVAL_SECONDS,
  firstReminderWaitSeconds,
  isBusySnoozeActive,
  isReminderDebounced,
  nextReminderWaitSeconds,
  planAcceptanceReminder,
} from './order-acceptance-reminder.util';

describe('order-acceptance-reminder.util', () => {
  const now = Date.parse('2026-08-28T12:00:00.000Z');

  it('schedules the first reminder only when the window is longer than 15 min', () => {
    expect(firstReminderWaitSeconds(900)).toBeNull();
    expect(firstReminderWaitSeconds(2700)).toBe(
      ACCEPTANCE_REMINDER_INTERVAL_SECONDS
    );
  });

  it('detects an active Busy snooze', () => {
    expect(
      isBusySnoozeActive({
        busyExtraPrepMinutes: 20,
        updatedAt: '2026-08-28T11:50:00.000Z',
        snoozeMinutes: 15,
        nowMs: now,
      })
    ).toBe(true);
    expect(
      isBusySnoozeActive({
        busyExtraPrepMinutes: 20,
        updatedAt: '2026-08-28T11:40:00.000Z',
        snoozeMinutes: 15,
        nowMs: now,
      })
    ).toBe(false);
    expect(
      isBusySnoozeActive({
        busyExtraPrepMinutes: 0,
        updatedAt: '2026-08-28T11:50:00.000Z',
        snoozeMinutes: 15,
        nowMs: now,
      })
    ).toBe(false);
  });

  it('debounces recent reminders', () => {
    expect(
      isReminderDebounced({
        lastReminderAt: '2026-08-28T11:50:00.000Z',
        nowMs: now,
      })
    ).toBe(true);
    expect(
      isReminderDebounced({
        lastReminderAt: '2026-08-28T11:40:00.000Z',
        nowMs: now,
      })
    ).toBe(false);
  });

  it('chains another 15 min reminder when enough time remains', () => {
    expect(nextReminderWaitSeconds(20 * 60)).toBe(
      ACCEPTANCE_REMINDER_INTERVAL_SECONDS
    );
    expect(nextReminderWaitSeconds(16 * 60)).toBeNull();
  });

  it('skips when not awaiting acceptance (including grace)', () => {
    expect(
      planAcceptanceReminder({
        currentStatus: 'pending',
        acceptanceState: 'grace',
        acceptanceDeadlineAt: '2026-08-28T12:30:00.000Z',
        busyExtraPrepMinutes: 0,
        updatedAt: null,
        snoozeMinutes: 15,
        lastReminderAt: null,
        nowMs: now,
      })
    ).toEqual({ action: 'skip', reason: 'not_awaiting_acceptance' });
  });

  it('reschedules to Busy snooze end instead of notifying', () => {
    const plan = planAcceptanceReminder({
      currentStatus: 'pending',
      acceptanceState: 'awaiting_acceptance',
      acceptanceDeadlineAt: '2026-08-28T12:40:00.000Z',
      busyExtraPrepMinutes: 20,
      updatedAt: '2026-08-28T11:55:00.000Z',
      snoozeMinutes: 15,
      lastReminderAt: null,
      nowMs: now,
    });
    expect(plan).toEqual({
      action: 'reschedule',
      waitSeconds: 10 * 60,
      reason: 'busy_snooze',
    });
  });

  it('skips when the deadline is imminent', () => {
    expect(
      planAcceptanceReminder({
        currentStatus: 'pending',
        acceptanceState: 'awaiting_acceptance',
        acceptanceDeadlineAt: '2026-08-28T12:00:30.000Z',
        busyExtraPrepMinutes: 0,
        updatedAt: null,
        snoozeMinutes: 15,
        lastReminderAt: null,
        nowMs: now,
      })
    ).toEqual({ action: 'skip', reason: 'deadline_imminent' });
  });

  it('sends and schedules the next reminder when time remains', () => {
    expect(
      planAcceptanceReminder({
        currentStatus: 'pending',
        acceptanceState: 'awaiting_acceptance',
        acceptanceDeadlineAt: '2026-08-28T12:30:00.000Z',
        busyExtraPrepMinutes: 0,
        updatedAt: null,
        snoozeMinutes: 15,
        lastReminderAt: null,
        nowMs: now,
      })
    ).toEqual({
      action: 'send',
      remainingSeconds: 30 * 60,
      nextWaitSeconds: ACCEPTANCE_REMINDER_INTERVAL_SECONDS,
    });
  });

  it('reschedules without sending when debounced', () => {
    expect(
      planAcceptanceReminder({
        currentStatus: 'pending',
        acceptanceState: 'awaiting_acceptance',
        acceptanceDeadlineAt: '2026-08-28T12:40:00.000Z',
        busyExtraPrepMinutes: 0,
        updatedAt: null,
        snoozeMinutes: 15,
        lastReminderAt: '2026-08-28T11:55:00.000Z',
        nowMs: now,
      })
    ).toEqual({
      action: 'reschedule',
      waitSeconds: ACCEPTANCE_REMINDER_INTERVAL_SECONDS,
      reason: 'debounced',
    });
  });
});

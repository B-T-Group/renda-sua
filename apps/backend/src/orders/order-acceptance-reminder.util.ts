/** Mid-window nudge interval while the merchant confirm SLA is active. */
export const ACCEPTANCE_REMINDER_INTERVAL_SECONDS = 15 * 60;

/** Cooked-food first nudge (~2.5 min). */
export const FOOD_ACCEPTANCE_REMINDER_FIRST_SECONDS = 150;

/** Cooked-food repeat interval (5 min). */
export const FOOD_ACCEPTANCE_REMINDER_INTERVAL_SECONDS = 5 * 60;

/** Skip a send when a reminder was already recorded this recently (Busy overlaps). */
export const ACCEPTANCE_REMINDER_DEBOUNCE_MINUTES = 12;

/** Food reminders debounce more tightly so 5-minute cadence works. */
export const FOOD_ACCEPTANCE_REMINDER_DEBOUNCE_MINUTES = 4;

/** Do not remind when the acceptance deadline is this close — deadline owns escalation. */
export const ACCEPTANCE_REMINDER_IMMINENT_SECONDS = 60;

export type ReminderPlan =
  | { action: 'skip'; reason: string }
  | { action: 'reschedule'; waitSeconds: number; reason: string }
  | {
      action: 'send';
      remainingSeconds: number;
      nextWaitSeconds: number | null;
    };

export function reminderCadence(containsCookedFood?: boolean): {
  firstWaitSeconds: number;
  intervalSeconds: number;
  debounceMinutes: number;
} {
  if (containsCookedFood) {
    return {
      firstWaitSeconds: FOOD_ACCEPTANCE_REMINDER_FIRST_SECONDS,
      intervalSeconds: FOOD_ACCEPTANCE_REMINDER_INTERVAL_SECONDS,
      debounceMinutes: FOOD_ACCEPTANCE_REMINDER_DEBOUNCE_MINUTES,
    };
  }
  return {
    firstWaitSeconds: ACCEPTANCE_REMINDER_INTERVAL_SECONDS,
    intervalSeconds: ACCEPTANCE_REMINDER_INTERVAL_SECONDS,
    debounceMinutes: ACCEPTANCE_REMINDER_DEBOUNCE_MINUTES,
  };
}

export function firstReminderWaitSeconds(
  timeoutSec: number,
  containsCookedFood?: boolean
): number | null {
  const { firstWaitSeconds } = reminderCadence(containsCookedFood);
  if (timeoutSec <= firstWaitSeconds + ACCEPTANCE_REMINDER_IMMINENT_SECONDS) {
    return null;
  }
  return firstWaitSeconds;
}

export function isBusySnoozeActive(params: {
  busyExtraPrepMinutes: number;
  updatedAt: string | null | undefined;
  snoozeMinutes: number;
  nowMs?: number;
}): boolean {
  if (!(params.busyExtraPrepMinutes > 0) || !params.updatedAt) return false;
  const updatedMs = Date.parse(params.updatedAt);
  if (!Number.isFinite(updatedMs)) return false;
  const nowMs = params.nowMs ?? Date.now();
  return updatedMs >= nowMs - params.snoozeMinutes * 60 * 1000;
}

export function busySnoozeRemainingSeconds(params: {
  updatedAt: string;
  snoozeMinutes: number;
  nowMs?: number;
}): number {
  const updatedMs = Date.parse(params.updatedAt);
  const nowMs = params.nowMs ?? Date.now();
  const endsAt = updatedMs + params.snoozeMinutes * 60 * 1000;
  return Math.max(1, Math.round((endsAt - nowMs) / 1000));
}

export function isReminderDebounced(params: {
  lastReminderAt: string | null | undefined;
  debounceMinutes?: number;
  nowMs?: number;
}): boolean {
  if (!params.lastReminderAt) return false;
  const lastMs = Date.parse(params.lastReminderAt);
  if (!Number.isFinite(lastMs)) return false;
  const debounceMs =
    (params.debounceMinutes ?? ACCEPTANCE_REMINDER_DEBOUNCE_MINUTES) * 60 * 1000;
  return lastMs >= (params.nowMs ?? Date.now()) - debounceMs;
}

export function nextReminderWaitSeconds(
  remainingSeconds: number,
  intervalSeconds = ACCEPTANCE_REMINDER_INTERVAL_SECONDS
): number | null {
  if (remainingSeconds <= intervalSeconds + ACCEPTANCE_REMINDER_IMMINENT_SECONDS) {
    return null;
  }
  return intervalSeconds;
}

/**
 * Pure planner for mid-window acceptance reminders. Callers own DB + notify.
 */
export function planAcceptanceReminder(params: {
  currentStatus: string;
  acceptanceState: string | null;
  acceptanceDeadlineAt: string | null | undefined;
  busyExtraPrepMinutes: number;
  updatedAt: string | null | undefined;
  snoozeMinutes: number;
  lastReminderAt: string | null | undefined;
  nowMs?: number;
  containsCookedFood?: boolean;
}): ReminderPlan {
  const nowMs = params.nowMs ?? Date.now();
  const cadence = reminderCadence(params.containsCookedFood);
  if (params.currentStatus !== 'pending') {
    return { action: 'skip', reason: 'not_pending' };
  }
  if (params.acceptanceState !== 'awaiting_acceptance') {
    return { action: 'skip', reason: 'not_awaiting_acceptance' };
  }
  if (
    isBusySnoozeActive({
      busyExtraPrepMinutes: params.busyExtraPrepMinutes,
      updatedAt: params.updatedAt,
      snoozeMinutes: params.snoozeMinutes,
      nowMs,
    }) &&
    params.updatedAt
  ) {
    return {
      action: 'reschedule',
      waitSeconds: busySnoozeRemainingSeconds({
        updatedAt: params.updatedAt,
        snoozeMinutes: params.snoozeMinutes,
        nowMs,
      }),
      reason: 'busy_snooze',
    };
  }
  if (!params.acceptanceDeadlineAt) {
    return { action: 'skip', reason: 'no_deadline' };
  }
  const deadlineMs = Date.parse(params.acceptanceDeadlineAt);
  if (!Number.isFinite(deadlineMs)) {
    return { action: 'skip', reason: 'invalid_deadline' };
  }
  const remainingSeconds = Math.round((deadlineMs - nowMs) / 1000);
  if (remainingSeconds <= ACCEPTANCE_REMINDER_IMMINENT_SECONDS) {
    return { action: 'skip', reason: 'deadline_imminent' };
  }
  if (
    isReminderDebounced({
      lastReminderAt: params.lastReminderAt,
      debounceMinutes: cadence.debounceMinutes,
      nowMs,
    })
  ) {
    const nextWaitSeconds = nextReminderWaitSeconds(
      remainingSeconds,
      cadence.intervalSeconds
    );
    if (nextWaitSeconds == null) {
      return { action: 'skip', reason: 'debounced_no_next' };
    }
    return {
      action: 'reschedule',
      waitSeconds: nextWaitSeconds,
      reason: 'debounced',
    };
  }
  return {
    action: 'send',
    remainingSeconds,
    nextWaitSeconds: nextReminderWaitSeconds(
      remainingSeconds,
      cadence.intervalSeconds
    ),
  };
}

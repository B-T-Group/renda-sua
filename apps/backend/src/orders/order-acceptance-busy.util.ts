export const DEFAULT_BUSY_INTERRUPT_SNOOZE_MINUTES = 15;

export type BusySlaPatch = {
  acceptanceDeadlineAt: string | null;
  graceDeadlineAt: string | null;
  snoozeUntil: string;
  rescheduleEvent:
    | 'order.acceptance_deadline'
    | 'order.acceptance_grace_deadline'
    | null;
  waitSeconds: number;
};

export function extendTimestampIso(
  currentIso: string | null | undefined,
  snoozeMs: number,
  nowMs = Date.now()
): string {
  const snoozeUntil = nowMs + snoozeMs;
  const current = currentIso ? Date.parse(currentIso) : Number.NaN;
  const next = Number.isFinite(current)
    ? Math.max(current, snoozeUntil)
    : snoozeUntil;
  return new Date(next).toISOString();
}

export function remainingWaitSeconds(
  deadlineIso: string,
  nowMs = Date.now()
): number {
  return Math.max(1, Math.round((Date.parse(deadlineIso) - nowMs) / 1000));
}

export function isDeadlineInFuture(
  deadlineIso: string | null | undefined,
  nowMs = Date.now(),
  skewMs = 2000
): boolean {
  if (!deadlineIso) return false;
  const t = Date.parse(deadlineIso);
  return Number.isFinite(t) && t > nowMs + skewMs;
}

export function busySnoozeCutoffIso(
  snoozeMinutes: number,
  nowMs = Date.now()
): string {
  return new Date(nowMs - snoozeMinutes * 60 * 1000).toISOString();
}

/** Snooze the overlay only in awaiting_acceptance — not after SLA escalation. */
export function isBusyInterruptSnoozed(
  order: {
    acceptance_state?: string | null;
    busy_extra_prep_minutes?: number | null;
    updated_at?: string | null;
  },
  snoozeMinutes: number,
  nowMs = Date.now()
): boolean {
  if ((order.busy_extra_prep_minutes ?? 0) <= 0) return false;
  if (order.acceptance_state !== 'awaiting_acceptance') return false;
  const updated = Date.parse(order.updated_at ?? '');
  if (!Number.isFinite(updated)) return false;
  return updated >= Date.parse(busySnoozeCutoffIso(snoozeMinutes, nowMs));
}

export function buildBusySlaPatch(
  order: {
    acceptance_state: string | null;
    acceptance_deadline_at: string | null;
    grace_deadline_at: string | null;
  },
  snoozeMinutes: number,
  nowMs = Date.now()
): BusySlaPatch {
  const snoozeMs = snoozeMinutes * 60 * 1000;
  const snoozeUntil = new Date(nowMs + snoozeMs).toISOString();
  if (isGraceState(order.acceptance_state)) {
    const graceDeadlineAt = extendTimestampIso(
      order.grace_deadline_at,
      snoozeMs,
      nowMs
    );
    return {
      acceptanceDeadlineAt: order.acceptance_deadline_at,
      graceDeadlineAt,
      snoozeUntil,
      rescheduleEvent: 'order.acceptance_grace_deadline',
      waitSeconds: remainingWaitSeconds(graceDeadlineAt, nowMs),
    };
  }
  const acceptanceDeadlineAt = extendTimestampIso(
    order.acceptance_deadline_at,
    snoozeMs,
    nowMs
  );
  return {
    acceptanceDeadlineAt,
    graceDeadlineAt: order.grace_deadline_at,
    snoozeUntil,
    rescheduleEvent: 'order.acceptance_deadline',
    waitSeconds: remainingWaitSeconds(acceptanceDeadlineAt, nowMs),
  };
}

function isGraceState(state: string | null): boolean {
  return state === 'grace' || state === 'no_response';
}

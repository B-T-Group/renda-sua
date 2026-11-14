import {
  returnReportNotOut,
  returnReportNotStarted,
} from './rental-renter-return.errors';

const OUT_STATUSES = new Set(['active', 'awaiting_return']);

export function rentalIsOutWithRenter(
  booking: { status: string; actual_start_at: string | null },
  now: Date
): boolean {
  if (!OUT_STATUSES.has(booking.status)) return false;
  const started = booking.actual_start_at
    ? new Date(booking.actual_start_at).getTime()
    : Number.NaN;
  return Number.isFinite(started) && started <= now.getTime();
}

export function assertCanReportReturn(
  booking: { status: string; actual_start_at: string | null },
  now: Date
): void {
  if (rentalIsOutWithRenter(booking, now)) return;
  if (OUT_STATUSES.has(booking.status)) throw returnReportNotStarted();
  throw returnReportNotOut();
}

export const RETURN_ESCALATION_MS = 24 * 60 * 60 * 1000;

export function escalationCutoff(now: Date): string {
  return new Date(now.getTime() - RETURN_ESCALATION_MS).toISOString();
}

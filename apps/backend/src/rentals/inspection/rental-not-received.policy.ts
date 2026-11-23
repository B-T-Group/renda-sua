import { didntReceiveWindowOpen } from './rental-inspection.policy';
import { notReceivedWindowClosed } from './rental-not-received.errors';

export function assertCanReportNotReceived(
  booking: {
    inspection_policy_version: number | null;
    actual_start_at: string | null;
  },
  now: Date
): void {
  if (!didntReceiveWindowOpen(booking.actual_start_at, now)) throw notReceivedWindowClosed();
}

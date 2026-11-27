import { didntReceiveWindowOpen } from './rental-inspection.policy';
import { notReceivedReturnReported, notReceivedWindowClosed } from './rental-not-received.errors';

export function assertCanReportNotReceived(
  booking: {
    inspection_policy_version: number | null;
    actual_start_at: string | null;
    renter_reported_returned_at?: string | null;
  },
  now: Date
): void {
  // The renter already said they returned it: they can't also not have it.
  if (booking.renter_reported_returned_at) throw notReceivedReturnReported();
  if (!didntReceiveWindowOpen(booking.actual_start_at, now)) throw notReceivedWindowClosed();
}

import type { CollectedPayment } from './pickup-decline.money';

/** Registered by the decline service so the payment webhook can refund without a circular import. */
type LateRefund = (bookingId: string, extra?: CollectedPayment) => Promise<void>;
let refundLate: LateRefund | null = null;

export function registerLateCollectRefund(refund: LateRefund): void {
  refundLate = refund;
}

export async function refundLateCollectIfDeclined(
  booking: { id?: string; condition_declined_at?: string | null },
  extra?: CollectedPayment
): Promise<boolean> {
  if (!booking.condition_declined_at || !booking.id || !refundLate) return false;
  await refundLate(booking.id, extra);
  return true;
}

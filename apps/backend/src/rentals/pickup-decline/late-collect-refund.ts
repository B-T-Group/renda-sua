/** Registered by the decline service so the payment webhook can refund without a circular import. */
let refundLate: ((bookingId: string) => Promise<void>) | null = null;

export function registerLateCollectRefund(refund: (bookingId: string) => Promise<void>): void {
  refundLate = refund;
}

export async function refundLateCollectIfDeclined(booking: {
  id?: string;
  condition_declined_at?: string | null;
}): Promise<boolean> {
  if (!booking.condition_declined_at || !booking.id || !refundLate) return false;
  await refundLate(booking.id);
  return true;
}

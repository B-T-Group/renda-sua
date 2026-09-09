export type MomoPaymentPollPhase = 'waiting' | 'paid' | 'failed';

interface OrderPaymentSnapshot {
  payment_status?: string | null;
  deposit_status?: string | null;
  deposit_amount?: number | null;
  deposit_mobile_payment_transaction_id?: string | null;
}

/**
 * Resolve MoMo payment poll phase for one or more orders.
 * 
 * Deposit orders (#275 @ 3ed60fab):
 * - Success when deposit_status==='paid' (deposit collect succeeded)
 * - payment_status remains 'pending' (remainder unpaid)
 * - Fail when deposit_status==='failed'
 * 
 * Full-pay MoMo orders:
 * - Success when payment_status==='paid'
 * - Fail when payment_status==='failed'
 */
export function resolveMomoPaymentStatuses(
  orders: Array<OrderPaymentSnapshot>
): MomoPaymentPollPhase {
  if (orders.length === 0) return 'waiting';

  // Check each order for success/failure
  for (const order of orders) {
    const isDepositOrder =
      (order.deposit_amount != null && order.deposit_amount > 0) ||
      order.deposit_status != null ||
      order.deposit_mobile_payment_transaction_id != null;

    if (isDepositOrder) {
      // Deposit order: check deposit_status
      if (order.deposit_status === 'failed') return 'failed';
      if (order.deposit_status !== 'paid') return 'waiting';
    } else {
      // Full-pay order: check payment_status
      if (order.payment_status === 'failed') return 'failed';
      if (order.payment_status !== 'paid') return 'waiting';
    }
  }

  // All orders succeeded (deposit_status=paid or payment_status=paid)
  return 'paid';
}

export const MOMO_POLL_INTERVAL_MS = 5000;
export const MOMO_POLL_TIMEOUT_MS = 3 * 60 * 1000;

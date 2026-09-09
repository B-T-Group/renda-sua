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
 * Deposit orders (#275 merged @ 3ed60fab):
 * - Success when deposit_status==='paid' (deposit collect succeeded)
 * - payment_status remains 'pending' (remainder unpaid)
 * - Fail when deposit_status==='failed'
 * 
 * Full-pay MoMo orders:
 * - Success when payment_status==='paid'
 * - Fail when payment_status==='failed'
 * 
 * Aggregation (multi-order/cart):
 * - Any order failed → failed
 * - Any order pending (none failed) → waiting
 * - All orders succeeded → paid
 */
export function resolveMomoPaymentStatuses(
  orders: Array<OrderPaymentSnapshot>
): MomoPaymentPollPhase {
  if (orders.length === 0) return 'waiting';

  let anyFailed = false;
  let anyWaiting = false;

  for (const order of orders) {
    // Detect deposit order by:
    // - deposit_amount > 0, OR
    // - deposit_status is truthy AND not 'none' (Hasura default is non-null 'none'), OR
    // - deposit_mobile_payment_transaction_id present
    const isDepositOrder =
      (order.deposit_amount != null && order.deposit_amount > 0) ||
      (order.deposit_status != null && order.deposit_status !== 'none') ||
      order.deposit_mobile_payment_transaction_id != null;

    if (isDepositOrder) {
      // Deposit order: check deposit_status
      if (order.deposit_status === 'failed') {
        anyFailed = true;
      } else if (order.deposit_status !== 'paid') {
        anyWaiting = true;
      }
      // deposit_status === 'paid' → success (continue checking other orders)
    } else {
      // Full-pay order: check payment_status
      if (order.payment_status === 'failed') {
        anyFailed = true;
      } else if (order.payment_status !== 'paid') {
        anyWaiting = true;
      }
      // payment_status === 'paid' → success (continue checking other orders)
    }
  }

  // Aggregate: any failure wins, then waiting, then paid
  if (anyFailed) return 'failed';
  if (anyWaiting) return 'waiting';
  return 'paid';
}

export const MOMO_POLL_INTERVAL_MS = 5000;
export const MOMO_POLL_TIMEOUT_MS = 3 * 60 * 1000;

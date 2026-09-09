export type MomoPaymentPollPhase = 'waiting' | 'paid' | 'failed';

interface OrderPaymentSnapshot {
  payment_status?: string | null;
  deposit_status?: string | null;
  deposit_amount?: number | null;
  deposit_mobile_payment_transaction_id?: string | null;
}

export type ResolveMomoPaymentOptions = {
  /**
   * When true, wait for deposit_status=paid (reservation deposit collect).
   * When false, wait for payment_status=paid (full pay or remainder after deposit).
   * When omitted, infer from deposit fields (legacy deposit-checkout heuristic).
   */
  expectDeposit?: boolean;
};

/**
 * Resolve MoMo payment poll phase for one or more orders.
 *
 * Deposit collect (#275):
 * - Success when deposit_status==='paid' (payment_status stays pending for remainder)
 * - Fail when deposit_status==='failed'
 *
 * Full-pay / remainder MoMo:
 * - Success when payment_status==='paid'
 * - Fail when payment_status==='failed'
 *
 * Aggregation (multi-order/cart):
 * - Any order failed → failed
 * - Any order pending (none failed) → waiting
 * - All orders succeeded → paid
 */
export function resolveMomoPaymentStatuses(
  orders: Array<OrderPaymentSnapshot>,
  options?: ResolveMomoPaymentOptions
): MomoPaymentPollPhase {
  if (orders.length === 0) return 'waiting';

  let anyFailed = false;
  let anyWaiting = false;

  for (const order of orders) {
    const treatAsDeposit = shouldTreatAsDepositCollect(order, options?.expectDeposit);

    if (treatAsDeposit) {
      if (order.deposit_status === 'failed') {
        anyFailed = true;
      } else if (order.deposit_status !== 'paid') {
        anyWaiting = true;
      }
    } else {
      if (order.payment_status === 'failed') {
        anyFailed = true;
      } else if (order.payment_status !== 'paid') {
        anyWaiting = true;
      }
    }
  }

  if (anyFailed) return 'failed';
  if (anyWaiting) return 'waiting';
  return 'paid';
}

function shouldTreatAsDepositCollect(
  order: OrderPaymentSnapshot,
  expectDeposit?: boolean
): boolean {
  if (expectDeposit === true) return true;
  if (expectDeposit === false) return false;
  // Legacy inference for callers that omit the flag (deposit checkout).
  return (
    (order.deposit_amount != null && order.deposit_amount > 0) ||
    (order.deposit_status != null && order.deposit_status !== 'none') ||
    order.deposit_mobile_payment_transaction_id != null
  );
}

export const MOMO_POLL_INTERVAL_MS = 5000;
export const MOMO_POLL_TIMEOUT_MS = 3 * 60 * 1000;

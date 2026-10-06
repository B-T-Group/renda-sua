/** Deposit collected: still held ('paid') or counted toward the price ('applied'). */
function depositCollectedStatus(status?: string | null): boolean {
  return status === 'paid' || status === 'applied';
}

/**
 * Remaining amount after a paid (or applied) MoMo reservation deposit.
 * Prefers server `amount_due`, else total − deposit.
 */
export function remainingAfterDeposit(order: {
  total_amount?: number | null;
  deposit_amount?: number | null;
  deposit_status?: string | null;
  amount_due?: number | null;
}): number {
  if (order.amount_due != null) return Math.max(0, Number(order.amount_due));
  const total = Number(order.total_amount) || 0;
  const deposit = Number(order.deposit_amount) || 0;
  if (depositCollectedStatus(order.deposit_status) && deposit > 0) {
    return Math.max(0, total - deposit);
  }
  return total;
}

export function isDepositPaid(order: {
  deposit_amount?: number | null;
  deposit_status?: string | null;
}): boolean {
  return (
    (Number(order.deposit_amount) || 0) > 0 &&
    depositCollectedStatus(order.deposit_status)
  );
}

/**
 * Cash exception is blocked for orders with captured/applied/forfeited deposits
 * to prevent fraud (agent keeping cash + commission without client confirmation).
 */
export function hasCashExceptionBlockingDeposit(order: {
  deposit_amount?: number | null;
  deposit_status?: string | null;
}): boolean {
  const depositAmount = Number(order.deposit_amount) || 0;
  const depositStatus = order.deposit_status;
  return (
    depositAmount > 0 &&
    depositStatus != null &&
    (depositStatus === 'paid' ||
      depositStatus === 'applied' ||
      depositStatus === 'forfeited')
  );
}

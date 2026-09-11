/**
 * Remaining amount after a paid MoMo reservation deposit.
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
  if (order.deposit_status === 'paid' && deposit > 0) {
    return Math.max(0, total - deposit);
  }
  return total;
}

export function isDepositPaid(order: {
  deposit_amount?: number | null;
  deposit_status?: string | null;
}): boolean {
  return (
    (Number(order.deposit_amount) || 0) > 0 && order.deposit_status === 'paid'
  );
}

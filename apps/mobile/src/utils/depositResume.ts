/**
 * Deposit resume utilities.
 *
 * - isDepositPending: order still needs a deposit (pending or failed retry) — gates sticky pay
 * - Poll-only path when deposit_mobile_payment_transaction_id points to a still-pending tx
 * - Retry path (retry-deposit-payment) when no live pending attempt exists
 */

import type { Order } from '../types/agent';

const RETRYABLE_DEPOSIT_STATUSES = new Set(['pending', 'failed']);

/**
 * True when the client must pay/retry the reservation deposit before any
 * pay-at-pickup / pay-at-delivery remainder flow.
 *
 * Includes `deposit_status === 'failed'` so Pay now does not fall through to
 * pickup payment (which requires ready_for_pickup).
 */
export function isDepositPending(order: Order): boolean {
  if (order.current_status !== 'pending_payment') {
    return false;
  }
  if (!RETRYABLE_DEPOSIT_STATUSES.has(order.deposit_status ?? '')) {
    return false;
  }
  const hasDepositAmount = (order.deposit_amount ?? 0) > 0;
  const hasDepositTx = !!order.deposit_mobile_payment_transaction_id;
  return hasDepositAmount || hasDepositTx;
}

/**
 * Determine if we have a live pending deposit transaction (poll-only path).
 *
 * This is a soft check: if we can detect a pending tx FK, we can open
 * await+poll without calling retry. But user tapping "Pay deposit" should
 * re-initiate per PE (provider prompts expire).
 */
export function hasLivePendingDepositTx(order: Order): boolean {
  return !!(
    order.deposit_status === 'pending' &&
    order.deposit_mobile_payment_transaction_id
  );
}

/** Remainder after deposit: prefer server `amount_due`, else total minus deposit. */
export function remainingAfterDeposit(order: {
  total_amount?: number | null;
  deposit_amount?: number | null;
  deposit_status?: string | null;
  amount_due?: number | null;
}): number {
  return resolveAmountDueAfterDeposit(order) ?? 0;
}

/**
 * Same as remainingAfterDeposit, but null when neither amount_due nor total_amount
 * is available (agent payloads strip total_amount until amount_due is enriched).
 */
export function resolveAmountDueAfterDeposit(order: {
  total_amount?: number | null;
  deposit_amount?: number | null;
  deposit_status?: string | null;
  amount_due?: number | null;
}): number | null {
  if (order.amount_due != null) return Math.max(0, Number(order.amount_due));
  if (order.total_amount == null) return null;
  return Math.max(0, Number(order.total_amount) - (order.deposit_amount ?? 0));
}

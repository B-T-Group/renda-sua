/**
 * Deposit resume utilities.
 *
 * PE RESOLUTION:
 * - isDepositPending: detect if order has a pending deposit that should gate sticky pay
 * - Poll-only path when deposit_mobile_payment_transaction_id points to a still-pending tx
 * - Retry path (retry-deposit-payment) when no live pending attempt exists
 */

import type { Order } from '../types/agent';

/**
 * Determine if an order has a pending deposit that should gate payment flow.
 *
 * Requirements (from PE):
 * isDepositPending = current_status === 'pending_payment'
 *   && deposit_status === 'pending'
 *   && (deposit_amount > 0 OR deposit_mobile_payment_transaction_id)
 */
export function isDepositPending(order: Order): boolean {
  if (order.current_status !== 'pending_payment') {
    return false;
  }
  if (order.deposit_status !== 'pending') {
    return false;
  }
  // deposit_amount > 0 OR deposit_mobile_payment_transaction_id exists
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

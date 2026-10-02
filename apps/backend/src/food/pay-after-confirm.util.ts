import { CookedFoodLine, isCookedFoodFulfillmentOrder } from './cooked-food-flag.util';

export type PayAfterConfirmReason = 'cooked_food';

export interface ResolvePayAfterConfirmInput {
  /** Catalog lines of the cart / preflight group (item cooked-food flags + category). */
  lines: CookedFoodLine[];
  fulfillment?: string | null;
  rail?: string | null;
  /** Client wallet already covers the total: pay immediately from the wallet. */
  canPayWithWallet: boolean;
  /** Zero / negative totals never need a payment request. */
  isZeroOrder: boolean;
}

/**
 * Single predicate for "the client pays AFTER the merchant confirms"
 * (orders.pay_after_merchant_confirm). Used by createOrder AND checkout preflight so the
 * two can never drift.
 *
 * Only the orders module may call this (rentals have their own flow). Fulfilment is limited
 * to pickup / delivery; shipping never qualifies (it requires pay-now).
 *
 * Returns the reason, or null when the order is not pay-after. Today the only reason is
 * cooked food; the per-location flag becomes a second reason in a later phase.
 */
export function resolvePayAfterConfirmReason(
  input: ResolvePayAfterConfirmInput
): PayAfterConfirmReason | null {
  if (input.rail !== 'mobile_money') return null;
  if (input.canPayWithWallet || input.isZeroOrder) return null;
  const cooked = isCookedFoodFulfillmentOrder({
    fulfillmentMethod: input.fulfillment,
    itemFlags: input.lines,
  });
  return cooked ? 'cooked_food' : null;
}

export function resolvePayAfterConfirm(
  input: ResolvePayAfterConfirmInput
): boolean {
  return resolvePayAfterConfirmReason(input) !== null;
}

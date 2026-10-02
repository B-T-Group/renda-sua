import { CookedFoodLine, isCookedFoodFulfillmentOrder } from './cooked-food-flag.util';

export type PayAfterConfirmReason = 'cooked_food' | 'location_flag';

export interface ResolvePayAfterConfirmInput {
  /** Catalog lines of the cart / preflight group (item cooked-food flags + category). */
  lines: CookedFoodLine[];
  fulfillment?: string | null;
  rail?: string | null;
  /** Client wallet already covers the total: pay immediately from the wallet. */
  canPayWithWallet: boolean;
  /** Zero / negative totals never need a payment request. */
  isZeroOrder: boolean;
  /** Diaspora payers are card-only: the flag is a no-op for them. */
  isDiaspora?: boolean;
  /**
   * True when the kill switch (`pay_after_confirm_location_flag_enabled`) is ON and ANY
   * line's business location has `business_locations.pay_at_confirm = true`. The caller
   * resolves this from ALL lines (a mixed-location cart with one flagged location makes the
   * whole order pay-after). Never read the location again after the order is created.
   */
  locationPayAtConfirm?: boolean;
}

/**
 * Single predicate for "the client pays AFTER the merchant confirms"
 * (orders.pay_after_merchant_confirm). Used by createOrder AND checkout preflight so the
 * two can never drift.
 *
 * Only the orders module may call this (rentals have their own flow). Fulfilment is limited
 * to pickup / delivery; shipping never qualifies (it requires pay-now).
 *
 * Returns the reason, or null when the order is not pay-after. Reasons:
 *  - `cooked_food`: every line is cooked food.
 *  - `location_flag`: any line is sold from a location with pay_at_confirm on (kill switch on).
 */
export function resolvePayAfterConfirmReason(
  input: ResolvePayAfterConfirmInput
): PayAfterConfirmReason | null {
  if (input.rail !== 'mobile_money' || input.isDiaspora === true) return null;
  if (input.canPayWithWallet || input.isZeroOrder) return null;
  if (input.fulfillment !== 'pickup' && input.fulfillment !== 'delivery') {
    return null;
  }
  const cooked = isCookedFoodFulfillmentOrder({
    fulfillmentMethod: input.fulfillment,
    itemFlags: input.lines,
  });
  if (cooked) return 'cooked_food';
  return input.locationPayAtConfirm === true ? 'location_flag' : null;
}

export function resolvePayAfterConfirm(
  input: ResolvePayAfterConfirmInput
): boolean {
  return resolvePayAfterConfirmReason(input) !== null;
}

/** Kill switch (global row of application_configurations); default false. */
export const PAY_AFTER_CONFIRM_LOCATION_FLAG_KEY =
  'pay_after_confirm_location_flag_enabled';

/** Minutes a stock-tracked pay-after order may stay unpaid after confirm (cooked keeps hours). */
export const DEFAULT_PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES = 45;

/** True when any line's location has the flag on (kill switch NOT applied here). */
export function anyLocationPayAtConfirm(
  lines: Array<{ business_location?: { pay_at_confirm?: boolean | null } | null }>
): boolean {
  return lines.some((l) => l?.business_location?.pay_at_confirm === true);
}

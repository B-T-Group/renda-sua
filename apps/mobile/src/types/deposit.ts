/**
 * MoMo deposit checkout types.
 *
 * Deposit path: customer pays a small reservation deposit now (via MoMo),
 * remainder when order is delivered/picked up. Server returns deposit_amount;
 * client fallback: max(150 XAF, percentage based on grand total).
 *
 * Backend contract (renda-sua #275, merged main @ 3ed60fab):
 * - deposit_status enum: none | pending | paid | failed | forfeited | refunded
 * - Note: pending_payment is current_status, NOT deposit_status
 */

export type DepositStatus = 'none' | 'pending' | 'paid' | 'failed' | 'forfeited' | 'refunded';

export interface DepositConfig {
  /** Server-authoritative deposit amount (XAF). UI always prefers this when present. */
  deposit_amount?: number | null;
  /** Deposit paid so far (XAF). */
  deposit_paid?: number | null;
  /** Remaining amount due (XAF). */
  amount_due?: number | null;
  /** Deposit payment status. */
  deposit_status?: DepositStatus | null;
  /** True when MoMo pay-now for delivery is enabled (default false; hide full pay-now). */
  momo_pay_now_delivery_enabled?: boolean | null;
}

/**
 * Calculate fallback deposit amount when server deposit_amount is missing.
 * Rule: max(150, round(grand_total * (total<5000?0.10:0.05)))
 * 
 * Backend contract (renda-sua #282 merged @ eb9cca31):
 * - max(150, round(grand_total * (total<5000?0.10:0.05)))
 * - Market flag: application_configurations.config_key=momo_pay_now_delivery_enabled
 *   (country_code scoped, default false)
 */
export function calculateDepositFallback(grandTotalXAF: number): number {
  const FLOOR = 150;
  const percentage = grandTotalXAF < 5000 ? 0.1 : 0.05;
  const computed = Math.round(grandTotalXAF * percentage);
  return Math.max(FLOOR, computed);
}

/**
 * Resolve the deposit amount to charge: prefer server deposit_amount,
 * fallback to calculation when missing.
 */
export function resolveDepositAmount(
  grandTotalXAF: number,
  serverDepositAmount?: number | null
): number {
  if (serverDepositAmount != null && serverDepositAmount > 0) {
    return serverDepositAmount;
  }
  return calculateDepositFallback(grandTotalXAF);
}

/**
 * Whether checkout should show / charge a MoMo reservation deposit.
 * Prefers the server preflight quote. Never invents a deposit for cooked-food
 * orders (delivery or pickup). Once preflight has loaded, absence of a deposit
 * means no deposit — do not fall back to a client-side %.
 */
export function isMoMoDepositCheckoutPath(params: {
  isDiaspora?: boolean;
  isStripeRail?: boolean;
  depositAmount?: number | null;
  depositRequired?: boolean | null;
  groupDepositAmount?: number | null;
  groupDepositRequired?: boolean | null;
  /** True once a preflight response is available. */
  preflightLoaded?: boolean;
  momoPayNowDeliveryEnabled?: boolean;
  payTiming?: string | null;
  /**
   * Cooked-food delivery/pickup: no reservation deposit
   * (pay-after-confirm or otherwise).
   */
  cookedFoodOrder?: boolean;
  /** @deprecated Use cookedFoodOrder */
  cookedFoodPayAfterConfirm?: boolean;
}): boolean {
  if (params.isDiaspora || params.isStripeRail) return false;
  if (params.cookedFoodOrder || params.cookedFoodPayAfterConfirm) return false;

  const amount = params.depositAmount ?? params.groupDepositAmount;
  const required = params.depositRequired ?? params.groupDepositRequired;
  if (amount != null && Number(amount) > 0) return true;
  if (required === true) return true;
  if (params.preflightLoaded) return false;

  const isPayAtDeliveryOrPickup =
    params.payTiming === 'pay_at_delivery' ||
    params.payTiming === 'pay_at_pickup';
  return !params.momoPayNowDeliveryEnabled && isPayAtDeliveryOrPickup;
}

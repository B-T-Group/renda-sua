/**
 * MoMo deposit checkout types.
 *
 * Deposit path: customer pays a merchant-opted reservation deposit now (via MoMo),
 * remainder when order is delivered/picked up. The server quotes deposit_amount.
 *
 * Backend contract (renda-sua #275, merged main @ 3ed60fab):
 * - deposit_status enum: none | pending | paid | failed | forfeited | refunded | applied
 *   (applied = counted toward the price at settlement / cash exception, renda-sua #460)
 * - Note: pending_payment is current_status, NOT deposit_status
 */

export type DepositStatus =
  | 'none'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'forfeited'
  | 'refunded'
  | 'applied';

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
 * Resolve the deposit amount to charge. Only a positive server quote counts.
 */
export function resolveDepositAmount(
  _grandTotal: number,
  serverDepositAmount?: number | null
): number {
  if (serverDepositAmount != null && serverDepositAmount > 0) {
    return serverDepositAmount;
  }
  return 0;
}

export function preflightDepositCopy(config?: {
  deposit_minimum_applied?: boolean | null;
  deposit_percent?: number | null;
  groups?: Array<{
    deposit_minimum_applied?: boolean | null;
    deposit_percent?: number | null;
  }> | null;
} | null): { minimumApplied: boolean; percent: number | null } {
  const group = config?.groups?.[0];
  const raw = config?.deposit_percent ?? group?.deposit_percent;
  const percent = raw != null && Number(raw) > 0 ? Number(raw) : null;
  return {
    minimumApplied: Boolean(
      config?.deposit_minimum_applied ?? group?.deposit_minimum_applied
    ),
    percent,
  };
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

  return false;
}

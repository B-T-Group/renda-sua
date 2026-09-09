/**
 * MoMo deposit checkout types.
 *
 * Deposit path: customer pays a small reservation deposit now (via MoMo),
 * remainder when order is delivered/picked up. Server returns deposit_amount;
 * client fallback: max(151 XAF, percentage based on grand total).
 */

export type DepositStatus = 'pending_payment' | 'paid' | 'forfeited' | 'refunded';

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
 * Rule: max(151, round(grand_total * (total<5000?0.10:0.05)))
 * 
 * Backend contract (renda-sua #275):
 * - max(151, round(grand_total * (total<5000?0.10:0.05)))
 * - Market flag: application_configurations.config_key=momo_pay_now_delivery_enabled
 *   (country_code scoped, default false)
 */
export function calculateDepositFallback(grandTotalXAF: number): number {
  const FLOOR = 151;
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

import { Injectable, Logger } from '@nestjs/common';

/**
 * MoMo reservation deposit floor amount in XAF.
 * MyPVIT docs may say amount > 150; if provider rejects 150, use 151.
 * Probe defensively and adjust if needed.
 */
export const DEPOSIT_FLOOR_XAF = 150;

/**
 * Deposit rate for orders under 5000 XAF
 */
const DEPOSIT_RATE_SMALL = 0.10;

/**
 * Deposit rate for orders 5000 XAF and above
 */
const DEPOSIT_RATE_LARGE = 0.05;

/**
 * Threshold for switching deposit rates (in XAF)
 */
const RATE_THRESHOLD_XAF = 5000;

export interface DepositCalculationResult {
  /** Calculated deposit amount in XAF (integer) */
  depositAmount: number;
  /** Rate used for calculation (0.10 or 0.05) */
  rate: number;
  /** Remaining amount due after deposit */
  amountDue: number;
  /** Total order amount at place-order (snapshot) */
  totalAmount: number;
}

@Injectable()
export class DepositCalculationService {
  private readonly logger = new Logger(DepositCalculationService.name);

  /**
   * Calculate deposit amount for a MoMo pay-at-delivery/pickup order.
   * 
   * Formula:
   *   rate = grand_total < 5000 ? 0.10 : 0.05
   *   deposit = max(FLOOR, round(grand_total * rate))
   * 
   * @param grandTotal Total order amount at place-order (items + fees)
   * @param currency Order currency (must be XAF)
   * @returns Deposit calculation result
   */
  calculateDeposit(
    grandTotal: number,
    currency: string
  ): DepositCalculationResult {
    if (currency !== 'XAF') {
      throw new Error(
        `Deposit calculation only supported for XAF, got ${currency}`
      );
    }

    if (grandTotal < 0) {
      throw new Error('Grand total cannot be negative');
    }

    // Determine rate based on total
    const rate =
      grandTotal < RATE_THRESHOLD_XAF ? DEPOSIT_RATE_SMALL : DEPOSIT_RATE_LARGE;

    // Calculate deposit: max(FLOOR, round(total * rate))
    const calculated = Math.round(grandTotal * rate);
    const depositAmount = Math.max(DEPOSIT_FLOOR_XAF, calculated);

    // Calculate remaining amount due
    const amountDue = Math.max(0, grandTotal - depositAmount);

    this.logger.debug(
      `Deposit calculation: total=${grandTotal} XAF, rate=${rate}, ` +
        `calculated=${calculated}, floor=${DEPOSIT_FLOOR_XAF}, ` +
        `deposit=${depositAmount}, due=${amountDue}`
    );

    return {
      depositAmount,
      rate,
      amountDue,
      totalAmount: grandTotal,
    };
  }

  /**
   * Check if deposit is required for the given payment configuration.
   * 
   * @param paymentTiming Order payment timing
   * @param paymentRail Payment rail (mobile_money, stripe, wallet)
   * @returns True if deposit should be collected
   */
  isDepositRequired(
    paymentTiming: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup',
    paymentRail: 'mobile_money' | 'stripe' | 'wallet'
  ): boolean {
    return (
      (paymentTiming === 'pay_at_delivery' || paymentTiming === 'pay_at_pickup') &&
      paymentRail === 'mobile_money'
    );
  }

  /**
   * Get deposit lock point for refund eligibility based on fulfillment method.
   * 
   * Refund via MoMo withdraw until lock:
   * - Delivery: Out for delivery
   * - Pickup: Ready for pickup
   * 
   * After lock: forfeit only
   * 
   * @param fulfillmentMethod Order fulfillment method
   * @param currentStatus Current order status
   * @returns True if order has passed the refund lock point
   */
  isAfterRefundLockPoint(
    fulfillmentMethod: 'delivery' | 'pickup' | 'shipping',
    currentStatus: string
  ): boolean {
    if (fulfillmentMethod === 'delivery') {
      return currentStatus === 'out_for_delivery' || currentStatus === 'delivered';
    }

    if (fulfillmentMethod === 'pickup') {
      return currentStatus === 'ready_for_pickup' || currentStatus === 'picked_up';
    }

    // Shipping: treat like delivery
    return currentStatus === 'out_for_delivery' || currentStatus === 'delivered';
  }
}

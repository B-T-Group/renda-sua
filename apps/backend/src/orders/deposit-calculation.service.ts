import { Injectable, Logger } from '@nestjs/common';

/**
 * MoMo reservation deposit minimum amount in XAF.
 * MyPVIT docs: amount > 150 XAF (strict greater-than, not >=).
 * Samuel locked: 150 XAF floor. If MyPVIT rejects, revert to 151.
 * Freemopay: same floor for UX parity unless code shows different min.
 * Other MM currencies: 10% with no floor (config later).
 */
export const MOMO_DEPOSIT_MIN_XAF = 150;

/**
 * Deposit rate for XAF orders under 5000
 */
const DEPOSIT_RATE_SMALL = 0.1;

/**
 * Deposit rate for XAF orders 5000 and above
 */
const DEPOSIT_RATE_LARGE = 0.05;

/**
 * Flat rate for non-XAF Mobile Money currencies
 */
const DEPOSIT_RATE_OTHER = 0.1;

/**
 * Threshold for switching deposit rates (XAF only)
 */
const RATE_THRESHOLD_XAF = 5000;

export interface DepositCalculationResult {
  /** Calculated deposit amount (integer) */
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
   * XAF:
   *   rate = grand_total < 5000 ? 0.10 : 0.05
   *   deposit = min(grandTotal, max(150, round(grand_total * rate)))
   *
   * Other currencies:
   *   deposit = min(grandTotal, round(grand_total * 0.10))  // no floor
   */
  calculateDeposit(
    grandTotal: number,
    currency: string
  ): DepositCalculationResult {
    if (grandTotal < 0) {
      throw new Error('Grand total cannot be negative');
    }

    const isXaf = currency === 'XAF';
    const rate = isXaf
      ? grandTotal < RATE_THRESHOLD_XAF
        ? DEPOSIT_RATE_SMALL
        : DEPOSIT_RATE_LARGE
      : DEPOSIT_RATE_OTHER;

    const calculated = Math.round(grandTotal * rate);
    const withFloor = isXaf
      ? Math.max(MOMO_DEPOSIT_MIN_XAF, calculated)
      : calculated;
    // Never collect more than the order total (tiny XAF orders vs 150 floor)
    const depositAmount = Math.min(grandTotal, withFloor);
    const amountDue = Math.max(0, grandTotal - depositAmount);

    this.logger.debug(
      `Deposit calculation: total=${grandTotal} ${currency}, rate=${rate}, ` +
        `calculated=${calculated}, deposit=${depositAmount}, due=${amountDue}`
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
   */
  isDepositRequired(
    paymentTiming: 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup',
    paymentRail: 'mobile_money' | 'stripe' | 'wallet'
  ): boolean {
    return (
      (paymentTiming === 'pay_at_delivery' ||
        paymentTiming === 'pay_at_pickup') &&
      paymentRail === 'mobile_money'
    );
  }

  /**
   * Amount to collect on remainder MoMo (pickup/delivery/cash recon).
   * When deposit is already paid, charge only total − deposit.
   */
  remainderPaymentAmount(order: {
    total_amount?: number | null;
    deposit_amount?: number | null;
    deposit_status?: string | null;
  }): number {
    const total = Number(order.total_amount) || 0;
    const deposit = Number(order.deposit_amount) || 0;
    if (order.deposit_status === 'paid' && deposit > 0) {
      return Math.max(0, total - deposit);
    }
    return total;
  }

  /**
   * Refund eligibility lock point:
   * - Delivery: Out for delivery
   * - Pickup: Ready for pickup
   * After lock: customer cancel → forfeit only (business/system may still refund)
   */
  isAfterRefundLockPoint(
    fulfillmentMethod: 'delivery' | 'pickup' | 'shipping',
    currentStatus: string
  ): boolean {
    if (fulfillmentMethod === 'delivery') {
      return (
        currentStatus === 'out_for_delivery' || currentStatus === 'delivered'
      );
    }

    if (fulfillmentMethod === 'pickup') {
      return (
        currentStatus === 'ready_for_pickup' || currentStatus === 'picked_up'
      );
    }

    return (
      currentStatus === 'out_for_delivery' || currentStatus === 'delivered'
    );
  }
}

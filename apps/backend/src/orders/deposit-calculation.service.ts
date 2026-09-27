import { Injectable, Logger } from '@nestjs/common';

/**
 * MoMo reservation deposit minimum in XAF.
 * MyPVIT docs: amount > 150 XAF (strict greater-than, not >=).
 * When opted-in item percents sum to less than this, charge this floor,
 * never more than the order total.
 */
export const MOMO_DEPOSIT_MIN_XAF = 150;

export interface DepositLineInput {
  unitPrice: number;
  quantity: number;
  initialDepositEnabled?: boolean | null;
  initialDepositPercent?: number | null;
  isCookedFood?: boolean | null;
}

export interface DepositLineSnapshot {
  initialDepositPercent: number | null;
  initialDepositAmount: number | null;
}

export interface ItemDepositCalculationResult {
  depositAmount: number;
  amountDue: number;
  totalAmount: number;
  minimumApplied: boolean;
  /** Set when every contributing line shares one percent and the floor did not apply. */
  percent: number | null;
  lines: DepositLineSnapshot[];
}

@Injectable()
export class DepositCalculationService {
  private readonly logger = new Logger(DepositCalculationService.name);

  /**
   * Deposit for MoMo pay-at-delivery/pickup from opted-in item lines.
   * Each line is round(unit price x quantity x percent / 100).
   * XAF sums under 150 are raised to 150, then capped at the order total.
   */
  calculateItemDeposit(input: {
    lines: DepositLineInput[];
    currency: string;
    orderTotal: number;
  }): ItemDepositCalculationResult {
    if (input.orderTotal < 0) {
      throw new Error('Grand total cannot be negative');
    }
    const lines = input.lines.map((line) => lineInitialDepositAmount(line));
    const sum = lines.reduce(
      (total, line) => total + (line.initialDepositAmount ?? 0),
      0
    );
    return this.applyDepositFloor({
      lines,
      sum,
      currency: input.currency,
      orderTotal: input.orderTotal,
    });
  }

  /**
   * Check if a deposit can be collected for this payment configuration.
   * The amount is still zero unless an item opted in.
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

  private applyDepositFloor(input: {
    lines: DepositLineSnapshot[];
    sum: number;
    currency: string;
    orderTotal: number;
  }): ItemDepositCalculationResult {
    if (input.sum <= 0) return emptyDeposit(input.lines, input.orderTotal);
    const raised = xafFloor(input.currency, input.sum);
    const depositAmount = Math.min(input.orderTotal, raised);
    const minimumApplied =
      input.currency === 'XAF' &&
      input.sum < MOMO_DEPOSIT_MIN_XAF &&
      depositAmount > input.sum;
    this.logger.debug(
      `Item deposit: sum=${input.sum} ${input.currency}, charge=${depositAmount}`
    );
    return {
      depositAmount,
      amountDue: Math.max(0, input.orderTotal - depositAmount),
      totalAmount: input.orderTotal,
      minimumApplied,
      percent: minimumApplied ? null : sharedDepositPercent(input.lines),
      lines: input.lines,
    };
  }
}

export function lineInitialDepositAmount(
  line: DepositLineInput
): DepositLineSnapshot {
  const percent = contributingPercent(line);
  if (percent == null) return emptyLine();
  const amount = Math.round(
    (Math.max(0, line.unitPrice) * Math.max(0, line.quantity) * percent) / 100
  );
  if (amount <= 0) return emptyLine();
  return { initialDepositPercent: percent, initialDepositAmount: amount };
}

function contributingPercent(line: DepositLineInput): number | null {
  if (line.isCookedFood || line.initialDepositEnabled !== true) return null;
  const percent = Number(line.initialDepositPercent);
  if (!Number.isInteger(percent) || percent < 1 || percent > 25) return null;
  return percent;
}

function sharedDepositPercent(lines: DepositLineSnapshot[]): number | null {
  const percents = lines
    .map((line) => line.initialDepositPercent)
    .filter((percent): percent is number => percent != null);
  if (percents.length === 0) return null;
  const first = percents[0];
  return percents.every((percent) => percent === first) ? first : null;
}

function emptyLine(): DepositLineSnapshot {
  return { initialDepositPercent: null, initialDepositAmount: null };
}

function emptyDeposit(
  lines: DepositLineSnapshot[],
  orderTotal: number
): ItemDepositCalculationResult {
  return {
    depositAmount: 0,
    amountDue: orderTotal,
    totalAmount: orderTotal,
    minimumApplied: false,
    percent: null,
    lines,
  };
}

function xafFloor(currency: string, sum: number): number {
  if (currency !== 'XAF' || sum >= MOMO_DEPOSIT_MIN_XAF) return sum;
  return MOMO_DEPOSIT_MIN_XAF;
}

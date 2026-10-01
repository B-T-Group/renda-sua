import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { isCookedFoodOrderSnapshot } from '../food/cooked-food-flag.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  itemSubtotalAfterDiscounts,
  normalizeFeeCountryCode,
  percentFee,
  resolveFeePercent,
} from './fee-percent.util';

/** `application_configurations.config_key` for the percentage cancellation fee. */
export const CANCELLATION_FEE_PERCENT_KEY = 'cancellation_fee_percent';

export type RefundType = 'full' | 'partial' | 'none' | 'wallet_credit' | 'authorization_release';
export type CancelledBy = 'client' | 'business' | 'agent' | 'system';

export interface CancellationReason {
  id: number;
  value: string;
  display: string;
}

export interface CancellationPolicy {
  canCancel: boolean;
  reasonIfBlocked?: string;
  refundType: RefundType;
  refundAmount: number;
  refundCurrency: string;
  cancellationFee: number;
  /** % of the item subtotal after discounts that `cancellationFee` was computed with. */
  cancellationFeePercent?: number;
  estimatedRefundProcessingTime: string;
  paymentSource: string;
  cancellationConsequences: string[];
  availableCancellationReasons: CancellationReason[];
}

const CLIENT_CANCELLABLE_STATUSES = [
  'pending_payment',
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
];

const FEE_APPLICABLE_STATUSES = ['confirmed', 'preparing', 'ready_for_pickup'];

const TERMINAL_STATUSES = new Set([
  'cancelled',
  'refunded',
  'complete',
  'failed',
  'refund_requested',
  'refund_approved_full',
  'refund_approved_partial',
  'refund_approved_replace',
  'refund_rejected',
]);

const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  GA: 'XAF',
  CM: 'XAF',
  CA: 'CAD',
  US: 'USD',
};

interface OrderForPolicy {
  id: string;
  current_status: string;
  assigned_agent_id?: string | null;
  total_amount: number;
  /** Fee base inputs: item subtotal after discounts = total - delivery fee paid - tax. */
  base_delivery_fee?: number | string | null;
  per_km_delivery_fee?: number | string | null;
  delivery_fee_waived?: boolean | null;
  tax_amount?: number | string | null;
  currency: string;
  payment_source?: string | null;
  payment_status?: string | null;
  payment_timing?: string | null;
  pay_after_merchant_confirm?: boolean | null;
  is_cooked_food_pickup?: boolean | null;
  /** Line snapshots (order_items.is_cooked_food) used for cooked-only rules. */
  order_items?: Array<{ is_cooked_food?: boolean | null }> | null;
  business_location?: { country_code?: string | null } | null;
}

export interface PolicyOptions {
  /**
   * Keep the legacy flat `cancellation_fee` calculation. ONLY for fail-pickup (customer
   * no-show at pickup), whose behaviour is intentionally unchanged (decision 3).
   */
  legacyFlatFee?: boolean;
}

const COOKED_READY_CLIENT_REASON_VALUES = new Set([
  'wont_make_it',
  'something_came_up',
  'momo_payment_issues',
  'other',
]);

@Injectable()
export class CancellationPolicyService {
  private readonly logger = new Logger(CancellationPolicyService.name);

  constructor(
    private readonly hasuraService: HasuraSystemService,
    private readonly configurationsService: ConfigurationsService
  ) {}

  async getPolicy(
    order: OrderForPolicy,
    persona: CancelledBy,
    options: PolicyOptions = {}
  ): Promise<CancellationPolicy> {
    const status = order.current_status;

    if (TERMINAL_STATUSES.has(status)) {
      return this.blockedPolicy(
        order,
        'consequences.terminalStatus',
        persona
      );
    }

    if (persona === 'client') {
      return this.getClientPolicy(order, options);
    }

    if (persona === 'business') {
      return this.getBusinessPolicy(order);
    }

    return this.blockedPolicy(order, 'consequences.notAuthorized', persona);
  }

  /** Confirmed+ normally bills a fee. Unpaid pay-after food has not committed funds. */
  private clientCancellationFeeApplies(order: OrderForPolicy): boolean {
    if (!FEE_APPLICABLE_STATUSES.includes(order.current_status)) return false;
    if (order.pay_after_merchant_confirm !== true) return true;
    const payment = (order.payment_status || '').toLowerCase();
    return payment === 'paid' || payment === 'authorized';
  }

  /**
   * Pay-at-delivery / pay-at-pickup orders never carry a cancellation fee (no hold, no
   * wallet charge). Cooked-food "pay after merchant confirm" orders are stored with
   * payment_timing pay_at_pickup but the client pays up front after confirm, so they
   * keep the existing paid/authorized rule in clientCancellationFeeApplies.
   */
  private isPayAtDeliveryOrPickup(order: OrderForPolicy): boolean {
    if (order.pay_after_merchant_confirm === true) return false;
    return (
      order.payment_timing === 'pay_at_delivery' ||
      order.payment_timing === 'pay_at_pickup'
    );
  }

  private async getClientPolicy(
    order: OrderForPolicy,
    options: PolicyOptions
  ): Promise<CancellationPolicy> {
    if (order.assigned_agent_id) {
      return this.blockedPolicy(order, 'blocked.agentAssigned', 'client');
    }

    if (!CLIENT_CANCELLABLE_STATUSES.includes(order.current_status)) {
      return this.blockedPolicy(order, 'blocked.terminalStatus', 'client');
    }

    const feeApplies = options.legacyFlatFee
      ? this.clientCancellationFeeApplies(order)
      : this.clientCancellationFeeApplies(order) &&
        !this.isPayAtDeliveryOrPickup(order);
    let cancellationFee = 0;
    let cancellationFeePercent: number | undefined;
    if (feeApplies && options.legacyFlatFee) {
      cancellationFee = await this.resolveLegacyFlatFee(
        order.business_location?.country_code ?? 'GA'
      );
    } else if (feeApplies) {
      const result = await this.resolvePercentFee(order);
      cancellationFee = result.fee;
      cancellationFeePercent = result.percent;
    }

    const totalMinorUnits = Math.round(order.total_amount * 100);
    const feeMinorUnits = Math.round(cancellationFee * 100);
    const refundMinorUnits = Math.max(0, totalMinorUnits - feeMinorUnits);
    const refundAmount = refundMinorUnits / 100;

    const refundType = this.resolveRefundType(
      order.payment_source ?? null,
      order.payment_status ?? null,
      cancellationFee,
      order.total_amount
    );

    const consequences = this.buildConsequences(order, 'client');
    let reasons = await this.fetchReasons('client');
    if (this.isCookedFoodReadyCancel(order)) {
      reasons = reasons.filter((r) =>
        COOKED_READY_CLIENT_REASON_VALUES.has(r.value)
      );
    }

    return {
      canCancel: true,
      refundType,
      refundAmount,
      refundCurrency: order.currency,
      cancellationFee,
      ...(cancellationFeePercent !== undefined ? { cancellationFeePercent } : {}),
      estimatedRefundProcessingTime: this.resolveProcessingTime(
        order.payment_source ?? null,
        order.payment_status
      ),
      paymentSource: order.payment_source ?? 'unknown',
      cancellationConsequences: consequences,
      availableCancellationReasons: reasons,
    };
  }

  private isCookedFoodReadyCancel(order: OrderForPolicy): boolean {
    if (order.current_status !== 'ready_for_pickup') return false;
    return (
      order.is_cooked_food_pickup === true ||
      (order.pay_after_merchant_confirm === true &&
        isCookedFoodOrderSnapshot(order))
    );
  }

  private async getBusinessPolicy(
    order: OrderForPolicy
  ): Promise<CancellationPolicy> {
    const earlyStatuses = [
      'pending_payment',
      'pending',
      'confirmed',
      'preparing',
    ];
    const isDeferredUncollected = this.isDeferredUncollected(order);

    if (!earlyStatuses.includes(order.current_status) && !isDeferredUncollected) {
      return this.blockedPolicy(order, 'blocked.terminalStatus', 'business');
    }

    // Paid cooked-food pay-after: business cannot cancel once cooking starts
    // (or confirmed+paid race). Use fail-pickup after ready instead.
    if (this.businessBlockedForCookedFoodPayAfter(order)) {
      return this.blockedPolicy(
        order,
        'blocked.cookedFoodPayAfterPaid',
        'business'
      );
    }

    const consequences = this.buildConsequences(order, 'business');
    const reasons = await this.fetchReasons('business');

    return {
      canCancel: true,
      refundType: 'full',
      refundAmount: order.total_amount,
      refundCurrency: order.currency,
      cancellationFee: 0,
      estimatedRefundProcessingTime: this.resolveProcessingTime(
        order.payment_source ?? null,
        order.payment_status
      ),
      paymentSource: order.payment_source ?? 'unknown',
      cancellationConsequences: consequences,
      availableCancellationReasons: reasons,
    };
  }

  private businessBlockedForCookedFoodPayAfter(order: OrderForPolicy): boolean {
    if (order.pay_after_merchant_confirm !== true) return false;
    // Cooked-food only: the kitchen already cooked once paid (line snapshots).
    if (!isCookedFoodOrderSnapshot(order)) return false;
    const payment = (order.payment_status || '').toLowerCase();
    if (payment !== 'paid' && payment !== 'authorized') return false;
    return (
      order.current_status === 'confirmed' ||
      order.current_status === 'preparing' ||
      order.current_status === 'ready_for_pickup'
    );
  }

  private async blockedPolicy(
    order: OrderForPolicy,
    reason: string,
    persona: CancelledBy
  ): Promise<CancellationPolicy> {
    const reasons = await this.fetchReasons(persona === 'business' ? 'business' : 'client');
    return {
      canCancel: false,
      reasonIfBlocked: reason,
      refundType: 'none',
      refundAmount: 0,
      refundCurrency: order.currency,
      cancellationFee: 0,
      estimatedRefundProcessingTime: '',
      paymentSource: order.payment_source ?? 'unknown',
      cancellationConsequences: [],
      availableCancellationReasons: reasons,
    };
  }

  private resolveRefundType(
    paymentSource: string | null,
    paymentStatus: string | null,
    cancellationFee: number,
    total: number
  ): RefundType {
    if (cancellationFee >= total) return 'none';
    if (
      paymentSource === 'credit_card' &&
      (paymentStatus === 'authorized' || paymentStatus === 'pending')
    ) {
      return 'authorization_release';
    }
    if (paymentSource === 'credit_card') {
      return cancellationFee > 0 ? 'partial' : 'full';
    }
    return 'wallet_credit';
  }

  private resolveProcessingTime(
    paymentSource: string | null,
    paymentStatus?: string | null
  ): string {
    if (
      paymentSource === 'credit_card' &&
      (paymentStatus === 'authorized' || paymentStatus === 'pending')
    ) {
      return 'authorization_release_immediate';
    }
    if (paymentSource === 'credit_card') return 'stripe_5_10_business_days';
    if (paymentSource === 'mobile_payment') return 'mobile_money_provider';
    return 'wallet_immediate';
  }

  private buildConsequences(
    order: OrderForPolicy,
    persona: CancelledBy
  ): string[] {
    const consequences: string[] = [];
    if (persona === 'client') consequences.push('consequences.businessNotified');
    if (persona === 'business') consequences.push('consequences.clientNotified');
    if (order.assigned_agent_id) consequences.push('consequences.agentNotified');
    consequences.push('consequences.cannotBeUndone');
    consequences.push('consequences.orderHistoryRetained');
    return consequences;
  }

  /**
   * Cancellation fee = `cancellation_fee_percent`% of the item subtotal after discounts
   * (excludes delivery fee and tax), rounded half-up to the currency minor unit.
   * The Python cancellation lambda computes the same number from the same order columns.
   *
   * Config resolution is explicit: a country row wins (CA = 0 is an intended explicit
   * row); no row at all logs `cancellation_fee_config_missing` at error level and uses
   * the 30% default; a Hasura read error propagates (never silently waives the fee).
   */
  async resolvePercentFee(
    order: OrderForPolicy
  ): Promise<{ fee: number; percent: number; base: number }> {
    const country = normalizeFeeCountryCode(order.business_location?.country_code);
    const { percent } = await resolveFeePercent(
      this.hasuraService,
      CANCELLATION_FEE_PERCENT_KEY,
      country,
      this.logger,
      'cancellation_fee_config_missing',
      `order=${order.id}`
    );
    const base = itemSubtotalAfterDiscounts(order);
    return { fee: percentFee(base, percent, order.currency), percent, base };
  }

  /**
   * LEGACY flat `cancellation_fee` (application_configurations number_value). Retired for
   * cancellations; still read ONLY by fail-pickup (customer no-show), whose behaviour is
   * unchanged. Missing row / read error still yield 0 here, exactly as before.
   */
  private async resolveLegacyFlatFee(countryCode: string): Promise<number> {
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        'cancellation_fee',
        countryCode
      );
      return config?.number_value ?? 0;
    } catch (error: any) {
      this.logger.warn(
        `Could not fetch cancellation fee for country ${countryCode}: ${error.message}`
      );
      return 0;
    }
  }

  private isDeferredUncollected(order: OrderForPolicy): boolean {
    const timing = order.payment_timing;
    if (timing !== 'pay_at_delivery' && timing !== 'pay_at_pickup') return false;
    const ps = order.payment_status;
    if (ps !== 'pending' && ps !== 'pending_payment') return false;
    return !TERMINAL_STATUSES.has(order.current_status);
  }

  private async fetchReasons(
    persona: 'client' | 'business'
  ): Promise<CancellationReason[]> {
    try {
      const query = `
        query GetCancellationReasons($persona: String!) {
          order_cancellation_reasons(
            where: { persona: { _contains: [$persona] } }
            order_by: { rank: asc }
          ) {
            id
            value
            display
          }
        }
      `;
      const response = await this.hasuraService.executeQuery<{
        order_cancellation_reasons: CancellationReason[];
      }>(query, { persona });
      return response.order_cancellation_reasons ?? [];
    } catch (error: any) {
      this.logger.warn(`Could not fetch cancellation reasons: ${error.message}`);
      return [];
    }
  }

  getCurrencyForCountry(countryCode: string): string {
    return COUNTRY_CURRENCY_MAP[countryCode] ?? 'XAF';
  }
}

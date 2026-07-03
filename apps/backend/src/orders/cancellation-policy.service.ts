import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

export type RefundType = 'full' | 'partial' | 'none' | 'wallet_credit';
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
  currency: string;
  payment_source?: string | null;
  payment_status?: string | null;
  payment_timing?: string | null;
  business_location?: { country_code?: string | null } | null;
}

@Injectable()
export class CancellationPolicyService {
  private readonly logger = new Logger(CancellationPolicyService.name);

  constructor(
    private readonly hasuraService: HasuraSystemService,
    private readonly configurationsService: ConfigurationsService
  ) {}

  async getPolicy(
    order: OrderForPolicy,
    persona: CancelledBy
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
      return this.getClientPolicy(order);
    }

    if (persona === 'business') {
      return this.getBusinessPolicy(order);
    }

    return this.blockedPolicy(order, 'consequences.notAuthorized', persona);
  }

  private async getClientPolicy(
    order: OrderForPolicy
  ): Promise<CancellationPolicy> {
    if (order.assigned_agent_id) {
      return this.blockedPolicy(order, 'blocked.agentAssigned', 'client');
    }

    if (!CLIENT_CANCELLABLE_STATUSES.includes(order.current_status)) {
      return this.blockedPolicy(order, 'blocked.terminalStatus', 'client');
    }

    const feeApplies = FEE_APPLICABLE_STATUSES.includes(order.current_status);
    const countryCode = order.business_location?.country_code ?? 'GA';
    const cancellationFee = feeApplies
      ? await this.resolveFee(countryCode)
      : 0;

    const totalMinorUnits = Math.round(order.total_amount * 100);
    const feeMinorUnits = Math.round(cancellationFee * 100);
    const refundMinorUnits = Math.max(0, totalMinorUnits - feeMinorUnits);
    const refundAmount = refundMinorUnits / 100;

    const refundType = this.resolveRefundType(
      order.payment_source ?? null,
      cancellationFee,
      order.total_amount
    );

    const consequences = this.buildConsequences(order, 'client');
    const reasons = await this.fetchReasons('client');

    return {
      canCancel: true,
      refundType,
      refundAmount,
      refundCurrency: order.currency,
      cancellationFee,
      estimatedRefundProcessingTime: this.resolveProcessingTime(
        order.payment_source ?? null
      ),
      paymentSource: order.payment_source ?? 'unknown',
      cancellationConsequences: consequences,
      availableCancellationReasons: reasons,
    };
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

    const consequences = this.buildConsequences(order, 'business');
    const reasons = await this.fetchReasons('business');

    return {
      canCancel: true,
      refundType: 'full',
      refundAmount: order.total_amount,
      refundCurrency: order.currency,
      cancellationFee: 0,
      estimatedRefundProcessingTime: this.resolveProcessingTime(
        order.payment_source ?? null
      ),
      paymentSource: order.payment_source ?? 'unknown',
      cancellationConsequences: consequences,
      availableCancellationReasons: reasons,
    };
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
    cancellationFee: number,
    total: number
  ): RefundType {
    if (cancellationFee >= total) return 'none';
    if (paymentSource === 'credit_card') {
      return cancellationFee > 0 ? 'partial' : 'full';
    }
    return 'wallet_credit';
  }

  private resolveProcessingTime(paymentSource: string | null): string {
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

  private async resolveFee(countryCode: string): Promise<number> {
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
            where: { persona: { _has_key: $persona } }
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

import { Injectable } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { businessReferralPayoutConfigKeyFromUser } from '../admin/business-referral-payout-config.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
  BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS,
  currencyForReferralPayout,
} from './business-referral-payout.constants';

export type ReferralProjectedPayout = {
  payableCount: number;
  amountPerReferral: number;
  projectedAmount: number;
  currency: string;
};

const ZERO: ReferralProjectedPayout = {
  payableCount: 0,
  amountPerReferral: 0,
  projectedAmount: 0,
  currency: 'XAF',
};

const APPROVED_ITEM_FILTER = {
  status: { _eq: 'active' },
  is_active: { _eq: true },
  moderation_status: { _eq: 'approved' },
};

@Injectable()
export class ReferralProjectedPayoutService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly configurationsService: ConfigurationsService
  ) {}

  async forAgent(
    agentId: string,
    userId: string
  ): Promise<ReferralProjectedPayout> {
    return this.project('referred_by_agent_id', agentId, userId, false);
  }

  async forBusiness(
    businessId: string,
    userId: string
  ): Promise<ReferralProjectedPayout> {
    return this.project('referred_by_business_id', businessId, userId, true);
  }

  private async project(
    referrerField: 'referred_by_agent_id' | 'referred_by_business_id',
    referrerId: string,
    userId: string,
    requireActiveLifecycle: boolean
  ): Promise<ReferralProjectedPayout> {
    const payableCount = await this.countPayable(
      this.payableWhere(referrerField, referrerId, requireActiveLifecycle)
    );
    const { countryCode, amountKey } = await this.loadUserPayoutContext(userId);
    const currency = currencyForReferralPayout(countryCode);
    if (payableCount <= 0 || !countryCode) {
      return { ...ZERO, currency };
    }
    return this.withAmount(payableCount, countryCode, amountKey, currency);
  }

  private payableWhere(
    referrerField: 'referred_by_agent_id' | 'referred_by_business_id',
    referrerId: string,
    requireActiveLifecycle: boolean
  ): Record<string, unknown> {
    return {
      [referrerField]: { _eq: referrerId },
      created_at: { _gte: BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE },
      items_aggregate: {
        count: {
          predicate: { _gte: BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS },
          filter: APPROVED_ITEM_FILTER,
        },
      },
      business_referral_reviews: { status: { _eq: 'approved' } },
      _not: { business_referral_payouts: {} },
      ...(requireActiveLifecycle
        ? { lifecycle_status: { _eq: 'active' } }
        : {}),
    };
  }

  private async countPayable(where: Record<string, unknown>): Promise<number> {
    const query = `
      query PayableReferralCount($where: businesses_bool_exp!) {
        businesses_aggregate(where: $where) {
          aggregate { count }
        }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        where,
      });
      return Number(result?.businesses_aggregate?.aggregate?.count ?? 0);
    } catch {
      return 0;
    }
  }

  private async loadUserPayoutContext(userId: string): Promise<{
    amountKey: string;
    countryCode: string | null;
  }> {
    const user = await this.loadUserRow(userId);
    const fromUser = user.country ? String(user.country).toUpperCase() : null;
    const fromRouting = fromUser
      ? null
      : await this.paymentRoutingService.getUserCountryCode(userId);
    const countryCode = fromUser ?? (fromRouting ? String(fromRouting).toUpperCase() : null);
    return { amountKey: user.amountKey, countryCode };
  }

  private async loadUserRow(userId: string): Promise<{
    amountKey: string;
    country: string | null;
  }> {
    const query = `
      query ProjectionPayoutUser($userId: uuid!) {
        users_by_pk(id: $userId) { internal country agent { id } }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      userId,
    });
    const row = result?.users_by_pk;
    return {
      amountKey: businessReferralPayoutConfigKeyFromUser(row),
      country: row?.country ?? null,
    };
  }

  private async withAmount(
    payableCount: number,
    countryCode: string,
    amountKey: string,
    currency: string
  ): Promise<ReferralProjectedPayout> {
    const amountPerReferral = await this.readPayoutAmount(countryCode, amountKey);
    return {
      payableCount,
      amountPerReferral,
      projectedAmount: payableCount * amountPerReferral,
      currency,
    };
  }

  private async readPayoutAmount(
    countryCode: string,
    amountKey: string
  ): Promise<number> {
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        amountKey,
        countryCode
      );
      return Number(config?.number_value ?? 0);
    } catch {
      return 0;
    }
  }
}

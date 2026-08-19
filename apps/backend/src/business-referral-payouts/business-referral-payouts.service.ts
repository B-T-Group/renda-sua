import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationsService } from '../admin/configurations.service';
import { businessReferralPayoutConfigKeyFromUser } from '../admin/business-referral-payout-config.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReferralPyramidService } from '../referrals/referral-pyramid.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';
import {
  BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
  BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS,
  currencyForReferralPayout,
} from './business-referral-payout.constants';
import type {
  PreviewEligibleBusiness,
  PreviewGross,
  PreviewPendingClaim,
  PayoutPreviewReferrer,
} from './referral-payout-preview.types';

interface EligibleAgentReferral {
  kind: 'agent';
  id: string;
  name: string;
  referred_by_agent_id: string;
  agent: {
    id: string;
    user_id: string;
    user: { id: string; first_name?: string; last_name?: string; preferred_language: string };
  };
  items_aggregate: { aggregate: { count: number } };
}

interface EligibleBusinessReferral {
  kind: 'business';
  id: string;
  name: string;
  referred_by_business_id: string;
  referring_business: {
    id: string;
    name?: string;
    user_id: string;
    user: { id: string; first_name?: string; last_name?: string; preferred_language: string };
  };
  items_aggregate: { aggregate: { count: number } };
}

type EligibleBusiness = EligibleAgentReferral | EligibleBusinessReferral;

interface IncompletePayoutRow {
  id: string;
  business_id: string;
  agent_id: string | null;
  referrer_business_id: string | null;
  amount: number;
  currency: string;
  business: { id: string; name: string };
  agent?: {
    id: string;
    user_id: string;
    user?: { first_name?: string; last_name?: string };
  } | null;
  referrer_business?: {
    id: string;
    name: string;
    user_id: string;
  } | null;
}

interface PayoutSummary {
  processed: number;
  credited: number;
  skipped: number;
  failures: number;
}

@Injectable()
export class BusinessReferralPayoutsService {
  private readonly logger = new Logger(BusinessReferralPayoutsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly configurationsService: ConfigurationsService,
    private readonly referralPyramidService: ReferralPyramidService
  ) {}

  async isPayoutFeatureEnabled(): Promise<boolean> {
    return this.isPayoutEnabled();
  }

  async listEligibleForPreview(): Promise<PreviewEligibleBusiness[]> {
    const rows = await this.fetchEligibleBusinesses();
    return rows.map((row) => this.toPreviewEligible(row));
  }

  async previewGrossForUser(userId: string): Promise<PreviewGross> {
    const countryCode = await this.paymentRoutingService.getUserCountryCode(
      userId
    );
    const normalized = countryCode ? String(countryCode).toUpperCase() : null;
    const configKey = await this.referrerPayoutAmountKey(userId);
    const amount = configKey
      ? await this.getPayoutAmount(configKey, countryCode)
      : 0;
    return {
      countryCode: normalized,
      currency: this.getCurrencyForCountry(countryCode),
      amount: amount || 0,
      configKey,
    };
  }

  async listIncompleteClaimsForPreview(): Promise<PreviewPendingClaim[]> {
    const rows = await this.loadIncompletePayoutRows();
    return rows.map((row) => this.toPreviewPendingClaim(row));
  }

  async runWeeklyPayouts(): Promise<PayoutSummary & { skippedReason?: string }> {
    const enabled = await this.isPayoutEnabled();
    if (!enabled) {
      this.logger.log('Business referral payouts are disabled — skipping.');
      return {
        processed: 0,
        credited: 0,
        skipped: 0,
        failures: 0,
        skippedReason: 'disabled',
      };
    }

    const businesses = await this.fetchEligibleBusinesses();
    this.logger.log(`Found ${businesses.length} eligible businesses for payout.`);

    const summary: PayoutSummary = {
      processed: 0,
      credited: 0,
      skipped: 0,
      failures: 0,
    };
    for (const business of businesses) {
      summary.processed++;
      try {
        const credited = await this.processBusinessPayout(business);
        credited ? summary.credited++ : summary.skipped++;
      } catch (error: any) {
        this.logger.error(
          `Payout failed for business ${business.id}: ${error.message}`
        );
        summary.failures++;
      }
    }

    const retried = await this.retryIncompletePayoutClaims();
    summary.processed += retried.processed;
    summary.credited += retried.credited;
    summary.skipped += retried.skipped;
    summary.failures += retried.failures;

    this.logger.log(`Payouts complete: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async retryIncompletePayoutClaims(): Promise<PayoutSummary> {
    const summary: PayoutSummary = {
      processed: 0,
      credited: 0,
      skipped: 0,
      failures: 0,
    };
    const rows = await this.loadIncompletePayoutRows();
    for (const row of rows) {
      summary.processed++;
      try {
        const ok = await this.retryIncompletePayout(row);
        ok ? summary.credited++ : summary.skipped++;
      } catch (error: any) {
        this.logger.error(
          `Incomplete payout retry failed for ${row.business_id}: ${error.message}`
        );
        summary.failures++;
      }
    }
    return summary;
  }

  private async loadIncompletePayoutRows(): Promise<IncompletePayoutRow[]> {
    const query = `
      query IncompleteBusinessReferralPayouts {
        business_referral_payouts(where: { transaction_id: { _is_null: true } }) {
          id
          business_id
          agent_id
          referrer_business_id
          account_id
          amount
          currency
          business { id name }
          agent { id user_id user { first_name last_name } }
          referrer_business { id name user_id }
        }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query);
      return result?.business_referral_payouts ?? [];
    } catch (error: any) {
      this.logger.error(
        `Failed to load incomplete referral payouts: ${error.message}`
      );
      return [];
    }
  }

  private async retryIncompletePayout(row: IncompletePayoutRow): Promise<boolean> {
    const earner = this.earnerFromIncompleteRow(row);
    if (!earner) {
      this.logger.warn(
        `Incomplete payout ${row.id} missing earner relation — skipping`
      );
      return false;
    }

    const result = await this.referralPyramidService.distributeReferralBonus({
      grossAmount: Number(row.amount),
      earner,
      referred: {
        kind: 'business',
        id: row.business_id,
        name: row.business?.name || 'Business',
      },
      preferPersonalAccount: earner.kind === 'agent',
      currency: row.currency,
      businessReferralPayoutId: row.id,
    });
    if (result.credited <= 0) return false;
    const primaryTx = result.transactionIds[0];
    if (primaryTx) {
      await this.attachTransactionId(row.business_id, primaryTx);
    }
    return true;
  }

  private async isPayoutEnabled(): Promise<boolean> {
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        'business_referral_payout_enabled'
      );
      return config?.boolean_value === true && config?.status === 'active';
    } catch (error: any) {
      this.logger.error(`Failed to read payout enabled config: ${error.message}`);
      return false;
    }
  }

  private async fetchEligibleBusinesses(): Promise<EligibleBusiness[]> {
    const [agentRefs, businessRefs] = await Promise.all([
      this.fetchEligibleAgentReferrals(),
      this.fetchEligibleBusinessReferrals(),
    ]);
    return [...agentRefs, ...businessRefs];
  }

  private async fetchEligibleAgentReferrals(): Promise<EligibleAgentReferral[]> {
    const query = `
      query EligibleAgentReferredBusinesses($cutoff: timestamptz!, $minItems: Int!) {
        businesses(
          where: {
            referred_by_agent_id: { _is_null: false }
            created_at: { _gte: $cutoff }
            items_aggregate: {
              count: {
                predicate: { _gte: $minItems }
                filter: {
                  status: { _eq: active }
                  is_active: { _eq: true }
                  moderation_status: { _eq: approved }
                }
              }
            }
            business_referral_reviews: { status: { _eq: "approved" } }
            _not: { business_referral_payouts: {} }
          }
        ) {
          id
          name
          referred_by_agent_id
          agent: referring_agent {
            id
            user_id
            user { id first_name last_name preferred_language }
          }
          items_aggregate(
            where: {
              status: { _eq: active }
              is_active: { _eq: true }
              moderation_status: { _eq: approved }
            }
          ) { aggregate { count } }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      cutoff: BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
      minItems: BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS,
    });
    return (result?.businesses ?? []).map((b: Omit<EligibleAgentReferral, 'kind'>) => ({
      ...b,
      kind: 'agent' as const,
    }));
  }

  private async fetchEligibleBusinessReferrals(): Promise<
    EligibleBusinessReferral[]
  > {
    const query = `
      query EligibleBusinessReferredBusinesses($cutoff: timestamptz!, $minItems: Int!) {
        businesses(
          where: {
            referred_by_business_id: { _is_null: false }
            lifecycle_status: { _eq: active }
            created_at: { _gte: $cutoff }
            items_aggregate: {
              count: {
                predicate: { _gte: $minItems }
                filter: {
                  status: { _eq: active }
                  is_active: { _eq: true }
                  moderation_status: { _eq: approved }
                }
              }
            }
            business_referral_reviews: { status: { _eq: "approved" } }
            _not: { business_referral_payouts: {} }
          }
        ) {
          id
          name
          referred_by_business_id
          referring_business {
            id
            name
            user_id
            user { id first_name last_name preferred_language }
          }
          items_aggregate(
            where: {
              status: { _eq: active }
              is_active: { _eq: true }
              moderation_status: { _eq: approved }
            }
          ) { aggregate { count } }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      cutoff: BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE,
      minItems: BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS,
    });
    return (result?.businesses ?? []).map(
      (b: Omit<EligibleBusinessReferral, 'kind'>) => ({
        ...b,
        kind: 'business' as const,
      })
    );
  }

  private async processBusinessPayout(
    business: EligibleBusiness
  ): Promise<boolean> {
    if (business.kind === 'agent') {
      return this.processAgentReferralPayout(business);
    }
    return this.processBusinessReferralPayout(business);
  }

  private toPreviewEligible(row: EligibleBusiness): PreviewEligibleBusiness {
    if (row.kind === 'agent') return this.toPreviewAgentEligible(row);
    return this.toPreviewBusinessEligible(row);
  }

  private toPreviewPendingClaim(row: IncompletePayoutRow): PreviewPendingClaim {
    const earner = this.earnerFromIncompleteRow(row);
    return {
      referredBusinessId: row.business_id,
      referredBusinessName: row.business?.name || 'Business',
      referralKind: earner?.kind ?? (row.agent_id ? 'agent' : 'business'),
      amount: Number(row.amount),
      currency: row.currency,
      earner,
    };
  }

  private earnerFromIncompleteRow(
    row: IncompletePayoutRow
  ): PayoutPreviewReferrer | null {
    if (row.agent_id && row.agent?.user_id) {
      return {
        kind: 'agent',
        id: row.agent.id,
        userId: row.agent.user_id,
        name: this.displayName(row.agent.user, 'Agent'),
      };
    }
    if (row.referrer_business_id && row.referrer_business?.user_id) {
      return {
        kind: 'business',
        id: row.referrer_business.id,
        userId: row.referrer_business.user_id,
        name: row.referrer_business.name || 'Business',
      };
    }
    return null;
  }

  private toPreviewAgentEligible(
    row: EligibleAgentReferral
  ): PreviewEligibleBusiness {
    const agent = row.agent;
    return {
      kind: 'agent',
      id: row.id,
      name: row.name,
      itemCount: row.items_aggregate.aggregate.count,
      earner: agent?.user_id
        ? {
            kind: 'agent',
            id: agent.id,
            userId: agent.user_id,
            name: this.displayName(agent.user, 'Agent'),
          }
        : null,
    };
  }

  private toPreviewBusinessEligible(
    row: EligibleBusinessReferral
  ): PreviewEligibleBusiness {
    const biz = row.referring_business;
    return {
      kind: 'business',
      id: row.id,
      name: row.name,
      itemCount: row.items_aggregate.aggregate.count,
      earner: biz?.user_id
        ? {
            kind: 'business',
            id: biz.id,
            userId: biz.user_id,
            name: biz.name || this.displayName(biz.user, 'Business'),
          }
        : null,
    };
  }

  private displayName(
    user: { first_name?: string; last_name?: string } | null | undefined,
    fallback: string
  ): string {
    const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
    return name || fallback;
  }

  private async processAgentReferralPayout(
    business: EligibleAgentReferral
  ): Promise<boolean> {
    const agent = business.agent;
    if (!agent?.user_id) {
      this.logger.warn(`No agent/user for business ${business.id} — skipping.`);
      return false;
    }

    const payout = await this.resolveReferrerPayoutContext({
      businessId: business.id,
      referrerUserId: agent.user_id,
      preferPersonalAccount: true,
    });
    if (!payout) return false;

    return this.claimAndDistribute({
      businessId: business.id,
      businessName: business.name,
      agentId: agent.id,
      referrerBusinessId: null,
      earner: {
        kind: 'agent',
        id: agent.id,
        userId: agent.user_id,
        name: 'Agent',
      },
      accountId: payout.accountId,
      amount: payout.amount,
      currency: payout.currency,
      rail: payout.rail,
      itemCount: business.items_aggregate.aggregate.count,
      preferPersonalAccount: true,
    });
  }

  private async processBusinessReferralPayout(
    business: EligibleBusinessReferral
  ): Promise<boolean> {
    const referrer = business.referring_business;
    if (!referrer?.user_id) {
      this.logger.warn(
        `No referring business/user for business ${business.id} — skipping.`
      );
      return false;
    }

    const payout = await this.resolveReferrerPayoutContext({
      businessId: business.id,
      referrerUserId: referrer.user_id,
      preferPersonalAccount: false,
      referrerBusinessId: referrer.id,
    });
    if (!payout) return false;

    return this.claimAndDistribute({
      businessId: business.id,
      businessName: business.name,
      agentId: null,
      referrerBusinessId: referrer.id,
      earner: {
        kind: 'business',
        id: referrer.id,
        userId: referrer.user_id,
        name: 'Business',
      },
      accountId: payout.accountId,
      amount: payout.amount,
      currency: payout.currency,
      rail: payout.rail,
      itemCount: business.items_aggregate.aggregate.count,
      preferPersonalAccount: false,
    });
  }

  private async claimAndDistribute(params: {
    businessId: string;
    businessName: string;
    agentId: string | null;
    referrerBusinessId: string | null;
    earner: {
      kind: 'agent' | 'business';
      id: string;
      userId: string;
      name: string;
    };
    accountId: string;
    amount: number;
    currency: string;
    rail: string;
    itemCount: number;
    preferPersonalAccount: boolean;
  }): Promise<boolean> {
    const payoutId = await this.claimPayoutRow(params);
    if (!payoutId) {
      this.logger.warn(
        `Payout already claimed for business ${params.businessId} — skipping.`
      );
      return false;
    }

    try {
      const earnerName = await this.resolveEarnerDisplayName(params.earner);
      const result = await this.referralPyramidService.distributeReferralBonus({
        grossAmount: params.amount,
        earner: { ...params.earner, name: earnerName },
        referred: {
          kind: 'business',
          id: params.businessId,
          name: params.businessName,
        },
        preferPersonalAccount: params.preferPersonalAccount,
        currency: params.currency,
        businessReferralPayoutId: payoutId,
      });
      if (result.credited <= 0) {
        await this.releasePayoutClaim(params.businessId);
        return false;
      }
      const primaryTx = result.transactionIds[0];
      if (primaryTx) {
        await this.attachTransactionId(params.businessId, primaryTx);
      }
      return true;
    } catch (error: any) {
      // Keep the claim when any wallet credit may already exist so retries
      // reuse the same payout id / stable deposit references.
      this.logger.error(
        `Pyramid distribute failed for business ${params.businessId}; claim retained for retry: ${error.message}`
      );
      throw error;
    }
  }

  private async resolveEarnerDisplayName(earner: {
    kind: 'agent' | 'business';
    id: string;
    name: string;
  }): Promise<string> {
    if (earner.kind === 'business') {
      const query = `
        query EarnerBusinessName($id: uuid!) {
          businesses_by_pk(id: $id) { name }
        }
      `;
      const result = await this.hasuraSystemService.executeQuery(query, {
        id: earner.id,
      });
      return result?.businesses_by_pk?.name || earner.name;
    }
    const query = `
      query EarnerAgentName($id: uuid!) {
        agents_by_pk(id: $id) {
          user { first_name last_name }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      id: earner.id,
    });
    const user = result?.agents_by_pk?.user;
    const name = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
    return name || earner.name;
  }

  private async resolveReferrerPayoutContext(params: {
    businessId: string;
    referrerUserId: string;
    preferPersonalAccount: boolean;
    referrerBusinessId?: string;
  }): Promise<{
    accountId: string;
    amount: number;
    currency: string;
    rail: string;
  } | null> {
    const countryCode = await this.paymentRoutingService.getUserCountryCode(
      params.referrerUserId
    );
    const currency = this.getCurrencyForCountry(countryCode);
    const amount = await this.resolvePayoutAmount(
      params.referrerUserId,
      countryCode,
      params.businessId
    );
    if (!amount) return null;

    const accountId = params.preferPersonalAccount
      ? await this.findPersonalAccountId(params.referrerUserId, currency)
      : await this.findBusinessAccountId(
          params.referrerBusinessId!,
          params.referrerUserId,
          currency
        );
    if (!accountId) {
      this.logger.warn(
        `No active ${currency} account for referrer ${params.referrerUserId} — skipping.`
      );
      return null;
    }

    const rail = await this.paymentRoutingService.resolveRailForUser(
      params.referrerUserId
    );
    return { accountId, amount, currency, rail };
  }

  private async resolvePayoutAmount(
    userId: string,
    countryCode: string | null,
    businessId: string
  ): Promise<number | null> {
    const amountKey = await this.referrerPayoutAmountKey(userId);
    if (!amountKey) {
      this.logger.warn(
        `Could not resolve payout tier for referrer ${userId} — skipping business ${businessId}.`
      );
      return null;
    }
    const amount = await this.getPayoutAmount(amountKey, countryCode);
    if (!amount || amount <= 0) {
      this.logger.warn(
        `No payout amount configured for country ${countryCode} — skipping business ${businessId}.`
      );
      return null;
    }
    return amount;
  }

  private async referrerPayoutAmountKey(userId: string): Promise<string | null> {
    const query = `
      query ReferrerPayoutUser($userId: uuid!) {
        users_by_pk(id: $userId) { internal agent { id } }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        userId,
      });
      const row = result?.users_by_pk;
      if (!row) return null;
      return businessReferralPayoutConfigKeyFromUser(row);
    } catch (error: any) {
      this.logger.warn(
        `Failed to read referrer payout tier for ${userId}: ${error.message}`
      );
      return null;
    }
  }

  private getCurrencyForCountry(countryCode: string | null): string {
    return currencyForReferralPayout(countryCode);
  }

  private async getPayoutAmount(
    configKey: string,
    countryCode: string | null
  ): Promise<number> {
    if (!countryCode) return 0;
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        configKey,
        countryCode.toUpperCase()
      );
      return Number(config?.number_value ?? 0);
    } catch (error: any) {
      this.logger.error(
        `Failed to read payout amount for ${countryCode}: ${error.message}`
      );
      return 0;
    }
  }

  private async findPersonalAccountId(
    userId: string,
    currency: string
  ): Promise<string | null> {
    const query = `
      query GetPersonalAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(
          where: {
            user_id: { _eq: $userId }
            is_active: { _eq: true }
            currency: { _eq: $currency }
            business_location_id: { _is_null: true }
          }
          limit: 1
        ) { id }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        userId,
        currency,
      });
      return result?.accounts?.[0]?.id ?? null;
    } catch (error: any) {
      this.logger.error(
        `Failed to find personal account for user ${userId}: ${error.message}`
      );
      return null;
    }
  }

  private async findBusinessAccountId(
    businessId: string,
    userId: string,
    currency: string
  ): Promise<string | null> {
    const query = `
      query GetBusinessAccount(
        $businessId: uuid!
        $userId: uuid!
        $currency: currency_enum!
      ) {
        accounts(
          where: {
            user_id: { _eq: $userId }
            is_active: { _eq: true }
            currency: { _eq: $currency }
            business_location: { business_id: { _eq: $businessId } }
          }
          limit: 1
        ) { id }
        personal: accounts(
          where: {
            user_id: { _eq: $userId }
            is_active: { _eq: true }
            currency: { _eq: $currency }
            business_location_id: { _is_null: true }
          }
          limit: 1
        ) { id }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        businessId,
        userId,
        currency,
      });
      return result?.accounts?.[0]?.id ?? result?.personal?.[0]?.id ?? null;
    } catch (error: any) {
      this.logger.error(
        `Failed to find business account for ${businessId}: ${error.message}`
      );
      return null;
    }
  }

  private async claimPayoutRow(params: {
    businessId: string;
    agentId: string | null;
    referrerBusinessId: string | null;
    accountId: string;
    amount: number;
    currency: string;
    rail: string;
    itemCount: number;
  }): Promise<string | null> {
    const mutation = `
      mutation ClaimBusinessReferralPayout($input: business_referral_payouts_insert_input!) {
        insert_business_referral_payouts_one(object: $input) { id }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeMutation(mutation, {
        input: {
          business_id: params.businessId,
          agent_id: params.agentId,
          referrer_business_id: params.referrerBusinessId,
          account_id: params.accountId,
          transaction_id: null,
          amount: params.amount,
          currency: params.currency,
          rail: params.rail,
          item_count: params.itemCount,
        },
      });
      return result?.insert_business_referral_payouts_one?.id ?? null;
    } catch (error: any) {
      if (this.isUniqueViolation(error)) return null;
      throw error;
    }
  }

  private async attachTransactionId(
    businessId: string,
    transactionId: string
  ): Promise<void> {
    const mutation = `
      mutation AttachReferralPayoutTransaction($businessId: uuid!, $transactionId: uuid!) {
        update_business_referral_payouts(
          where: { business_id: { _eq: $businessId } }
          _set: { transaction_id: $transactionId, updated_at: "now()" }
        ) { affected_rows }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      businessId,
      transactionId,
    });
  }

  private async releasePayoutClaim(businessId: string): Promise<void> {
    const mutation = `
      mutation ReleaseReferralPayoutClaim($businessId: uuid!) {
        delete_business_referral_payouts(where: { business_id: { _eq: $businessId } }) {
          affected_rows
        }
      }
    `;
    try {
      await this.hasuraSystemService.executeMutation(mutation, { businessId });
    } catch (error: any) {
      this.logger.error(
        `Failed to release payout claim for business ${businessId}: ${error.message}`
      );
    }
  }

  private isUniqueViolation(error: any): boolean {
    const message = String(error?.message || error || '').toLowerCase();
    return (
      message.includes('uniqueness violation') ||
      message.includes('unique constraint') ||
      message.includes('uq_business_referral_payouts_business_id')
    );
  }

}

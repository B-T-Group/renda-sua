import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { ConfigurationsService } from '../admin/configurations.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';

const BUSINESS_CUTOFF_DATE = '2026-04-01';
const MIN_ITEM_COUNT = 10;

interface EligibleAgentReferral {
  kind: 'agent';
  id: string;
  name: string;
  referred_by_agent_id: string;
  agent: {
    id: string;
    user_id: string;
    user: { id: string; preferred_language: string };
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
    user_id: string;
    user: { id: string; preferred_language: string };
  };
  items_aggregate: { aggregate: { count: number } };
}

type EligibleBusiness = EligibleAgentReferral | EligibleBusinessReferral;

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
    private readonly accountsService: AccountsService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly notificationsService: NotificationsService,
    private readonly configurationsService: ConfigurationsService
  ) {}

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

    this.logger.log(`Payouts complete: ${JSON.stringify(summary)}`);
    return summary;
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
            user { id preferred_language }
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
      cutoff: BUSINESS_CUTOFF_DATE,
      minItems: MIN_ITEM_COUNT,
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
            user_id
            user { id preferred_language }
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
      cutoff: BUSINESS_CUTOFF_DATE,
      minItems: MIN_ITEM_COUNT,
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
      amountKey: 'business_referral_payout_amount',
      preferPersonalAccount: true,
    });
    if (!payout) return false;

    const credited = await this.claimAndCredit({
      businessId: business.id,
      agentId: agent.id,
      referrerBusinessId: null,
      accountId: payout.accountId,
      amount: payout.amount,
      currency: payout.currency,
      rail: payout.rail,
      itemCount: business.items_aggregate.aggregate.count,
    });
    if (!credited) return false;

    await this.sendPayoutNotification(
      agent.user_id,
      business.name,
      payout.amount,
      payout.currency,
      agent.user.preferred_language
    );
    return true;
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
      amountKey: 'business_to_business_referral_amount',
      preferPersonalAccount: false,
      referrerBusinessId: referrer.id,
    });
    if (!payout) return false;

    const credited = await this.claimAndCredit({
      businessId: business.id,
      agentId: null,
      referrerBusinessId: referrer.id,
      accountId: payout.accountId,
      amount: payout.amount,
      currency: payout.currency,
      rail: payout.rail,
      itemCount: business.items_aggregate.aggregate.count,
    });
    if (!credited) return false;

    await this.sendPayoutNotification(
      referrer.user_id,
      business.name,
      payout.amount,
      payout.currency,
      referrer.user.preferred_language
    );
    return true;
  }

  private async claimAndCredit(params: {
    businessId: string;
    agentId: string | null;
    referrerBusinessId: string | null;
    accountId: string;
    amount: number;
    currency: string;
    rail: string;
    itemCount: number;
  }): Promise<boolean> {
    const claimed = await this.claimPayoutRow(params);
    if (!claimed) {
      this.logger.warn(
        `Payout already claimed for business ${params.businessId} — skipping.`
      );
      return false;
    }

    try {
      const transactionId = await this.creditReferrerAccount(
        params.accountId,
        params.amount,
        params.businessId
      );
      await this.attachTransactionId(params.businessId, transactionId);
      return true;
    } catch (error: any) {
      await this.releasePayoutClaim(params.businessId);
      throw error;
    }
  }

  private async resolveReferrerPayoutContext(params: {
    businessId: string;
    referrerUserId: string;
    amountKey: string;
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
    const amount = await this.getPayoutAmount(params.amountKey, countryCode);
    if (!amount || amount <= 0) {
      this.logger.warn(
        `No payout amount configured for country ${countryCode} — skipping business ${params.businessId}.`
      );
      return null;
    }

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

  private async creditReferrerAccount(
    accountId: string,
    amount: number,
    businessId: string
  ): Promise<string> {
    const existing = await this.accountsService.findDepositByReference(
      accountId,
      businessId
    );
    if (existing?.id) {
      this.logger.warn(
        `Reusing existing referral deposit ${existing.id} for business ${businessId}`
      );
      return existing.id;
    }

    const txResult = await this.accountsService.registerTransaction({
      accountId,
      amount,
      transactionType: 'deposit',
      memo: 'Business referral bonus',
      referenceId: businessId,
    });
    if (!txResult.success || !txResult.transactionId) {
      throw new Error(txResult.error || 'Failed to credit referral payout');
    }
    return txResult.transactionId;
  }

  private getCurrencyForCountry(countryCode: string | null): string {
    const map: Record<string, string> = {
      GA: 'XAF',
      CM: 'XAF',
      CA: 'CAD',
      US: 'USD',
    };
    return map[(countryCode ?? '').toUpperCase()] ?? 'XAF';
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
  }): Promise<boolean> {
    const mutation = `
      mutation ClaimBusinessReferralPayout($input: business_referral_payouts_insert_input!) {
        insert_business_referral_payouts_one(object: $input) { id }
      }
    `;
    try {
      await this.hasuraSystemService.executeMutation(mutation, {
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
      return true;
    } catch (error: any) {
      if (this.isUniqueViolation(error)) return false;
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

  private async sendPayoutNotification(
    userId: string,
    businessName: string,
    amount: number,
    currency: string,
    language: string
  ): Promise<void> {
    const isFr = (language ?? 'en').toLowerCase().startsWith('fr');
    const title = isFr ? 'Crédit de parrainage' : 'Referral credit';
    const body = isFr
      ? `Crédit pour parrainage entreprise ${businessName} — ${amount} ${currency}`
      : `Credit for business referral ${businessName} — ${amount} ${currency}`;
    try {
      await this.notificationsService.sendInternalPushByUserId(
        userId,
        title,
        body,
        {
          url: '/accounts',
          event: 'business_referral_credit',
        }
      );
    } catch (error: any) {
      this.logger.warn(
        `Push notification failed for user ${userId}: ${error.message}`
      );
    }
  }
}

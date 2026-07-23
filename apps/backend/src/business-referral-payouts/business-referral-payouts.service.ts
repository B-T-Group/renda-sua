import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { ConfigurationsService } from '../admin/configurations.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRoutingService } from '../stripe-payments/payment-routing.service';

const BUSINESS_CUTOFF_DATE = '2026-04-01';
const MIN_ITEM_COUNT = 10;

interface EligibleBusiness {
  id: string;
  name: string;
  referred_by_agent_id: string;
  agent: {
    id: string;
    user_id: string;
    user: {
      id: string;
      preferred_language: string;
    };
  };
  items_aggregate: {
    aggregate: { count: number };
  };
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
    private readonly accountsService: AccountsService,
    private readonly paymentRoutingService: PaymentRoutingService,
    private readonly notificationsService: NotificationsService,
    private readonly configurationsService: ConfigurationsService
  ) {}

  async runWeeklyPayouts(): Promise<PayoutSummary & { skippedReason?: string }> {
    const enabled = await this.isPayoutEnabled();
    if (!enabled) {
      this.logger.log('Business referral payouts are disabled — skipping.');
      return { processed: 0, credited: 0, skipped: 0, failures: 0, skippedReason: 'disabled' };
    }

    const businesses = await this.fetchEligibleBusinesses();
    this.logger.log(`Found ${businesses.length} eligible businesses for payout.`);

    const summary: PayoutSummary = { processed: 0, credited: 0, skipped: 0, failures: 0 };
    for (const business of businesses) {
      summary.processed++;
      try {
        const credited = await this.processBusinessPayout(business);
        credited ? summary.credited++ : summary.skipped++;
      } catch (error: any) {
        this.logger.error(`Payout failed for business ${business.id}: ${error.message}`);
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
    const query = `
      query EligibleReferredBusinesses($cutoff: timestamptz!, $minItems: Int!) {
        businesses(
          where: {
            referred_by_agent_id: { _is_null: false }
            created_at: { _gte: $cutoff }
            items_aggregate: { count: { predicate: { _gte: $minItems } } }
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
          items_aggregate { aggregate { count } }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      cutoff: BUSINESS_CUTOFF_DATE,
      minItems: MIN_ITEM_COUNT,
    });
    return result?.businesses ?? [];
  }

  private async processBusinessPayout(business: EligibleBusiness): Promise<boolean> {
    const agent = business.agent;
    if (!agent?.user_id) {
      this.logger.warn(`No agent/user for business ${business.id} — skipping.`);
      return false;
    }

    const { countryCode, currency, amount } = await this.resolvePayoutDetails(agent.user_id);
    if (!amount || amount <= 0) {
      this.logger.warn(`No payout amount configured for country ${countryCode} — skipping business ${business.id}.`);
      return false;
    }

    const accountId = await this.findAgentAccountId(agent.id, agent.user_id, currency);
    if (!accountId) {
      this.logger.warn(`No active ${currency} account for agent ${agent.id} — skipping.`);
      return false;
    }

    const rail = await this.paymentRoutingService.resolveRailForUser(agent.user_id);
    const txResult = await this.accountsService.registerTransaction({
      accountId,
      amount,
      transactionType: 'deposit',
      memo: 'Business referral bonus',
      referenceId: business.id,
    });

    await this.recordPayoutRow({
      businessId: business.id,
      agentId: agent.id,
      accountId,
      transactionId: txResult.transactionId,
      amount,
      currency,
      rail,
      itemCount: business.items_aggregate.aggregate.count,
    });

    await this.sendPayoutNotification(agent.user_id, business.name, amount, currency, agent.user.preferred_language);
    return true;
  }

  private async resolvePayoutDetails(userId: string): Promise<{
    countryCode: string | null;
    currency: string;
    amount: number;
  }> {
    const countryCode = await this.paymentRoutingService.getUserCountryCode(userId);
    const currency = this.getCurrencyForCountry(countryCode);
    const amount = await this.getPayoutAmount(countryCode);
    return { countryCode, currency, amount };
  }

  private getCurrencyForCountry(countryCode: string | null): string {
    const map: Record<string, string> = { GA: 'XAF', CM: 'XAF', CA: 'CAD', US: 'USD' };
    return map[(countryCode ?? '').toUpperCase()] ?? 'XAF';
  }

  private async getPayoutAmount(countryCode: string | null): Promise<number> {
    if (!countryCode) return 0;
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        'business_referral_payout_amount',
        countryCode.toUpperCase()
      );
      return Number(config?.number_value ?? 0);
    } catch (error: any) {
      this.logger.error(`Failed to read payout amount for ${countryCode}: ${error.message}`);
      return 0;
    }
  }

  private async findAgentAccountId(agentId: string, userId: string, currency: string): Promise<string | null> {
    const query = `
      query GetAgentAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(
          where: { user_id: { _eq: $userId }, is_active: { _eq: true }, currency: { _eq: $currency } }
          limit: 1
        ) { id }
      }
    `;
    try {
      const result = await this.hasuraSystemService.executeQuery(query, { userId, currency });
      return result?.accounts?.[0]?.id ?? null;
    } catch (error: any) {
      this.logger.error(`Failed to find account for agent ${agentId}: ${error.message}`);
      return null;
    }
  }

  private async recordPayoutRow(params: {
    businessId: string;
    agentId: string;
    accountId: string;
    transactionId?: string;
    amount: number;
    currency: string;
    rail: string;
    itemCount: number;
  }): Promise<void> {
    const mutation = `
      mutation InsertBusinessReferralPayout($input: business_referral_payouts_insert_input!) {
        insert_business_referral_payouts_one(object: $input) { id }
      }
    `;
    await this.hasuraSystemService.executeMutation(mutation, {
      input: {
        business_id: params.businessId,
        agent_id: params.agentId,
        account_id: params.accountId,
        transaction_id: params.transactionId ?? null,
        amount: params.amount,
        currency: params.currency,
        rail: params.rail,
        item_count: params.itemCount,
      },
    });
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
      await this.notificationsService.sendInternalPushByUserId(userId, title, body, {
        url: '/accounts',
        event: 'business_referral_credit',
      });
    } catch (error: any) {
      this.logger.warn(`Push notification failed for user ${userId}: ${error.message}`);
    }
  }
}

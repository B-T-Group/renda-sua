import { Injectable, Logger } from '@nestjs/common';
import type { ResolvedBusinessReferral } from '../business-referrals/business-referrals.service';
import { ConfigurationsService } from '../admin/configurations.service';
import {
  mapReferredBusinesses,
  REFERRED_BUSINESSES_LIST_SELECTION,
  type ReferredBusinessFollowUp,
  type ReferredBusinessRow,
} from '../business-referrals/referred-business-followup.util';
import { ONBOARDING_10_MIN_SALE_TOTAL_KEY } from '../representative-compensation/compensation-rules';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { ReferralPyramidService } from '../referrals/referral-pyramid.service';

interface ReferralConfig {
  referralAmount: number;
  maxReferralTotal: number;
}

interface AgentLookupResult {
  agentId: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
  userEmail: string;
  status: string;
  preferredLanguage: string;
}

export type { AgentLookupResult };

@Injectable()
export class AgentReferralsService {
  private readonly logger = new Logger(AgentReferralsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly referralPyramidService: ReferralPyramidService,
    private readonly configurationsService: ConfigurationsService
  ) {}

  normalizeAgentCode(agentCode: string): string | null {
    const normalized = agentCode.trim().toUpperCase();
    if (!normalized || !/^[A-Z0-9]{6}$/.test(normalized)) {
      return null;
    }
    return normalized;
  }

  async findAgentByCode(agentCode: string): Promise<AgentLookupResult | null> {
    const normalizedCode = this.normalizeAgentCode(agentCode);
    if (!normalizedCode) {
      return null;
    }

    const query = `
      query FindAgentByCode($agentCode: String!) {
        agents(where: { agent_code: { _eq: $agentCode } }, limit: 1) {
          id
          status
          user {
            id
            first_name
            last_name
            email
            preferred_language
          }
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        agentCode: normalizedCode,
      });
      const agent = result.agents?.[0];
      if (!agent?.user) {
        return null;
      }

      return {
        agentId: agent.id,
        userId: agent.user.id,
        userFirstName: agent.user.first_name,
        userLastName: agent.user.last_name,
        userEmail: agent.user.email ?? '',
        status: agent.status ?? 'active',
        preferredLanguage: agent.user.preferred_language ?? 'en',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to find agent by code ${normalizedCode}: ${error.message}`
      );
      return null;
    }
  }

  getAgentInsertReferralFields(resolved: ResolvedBusinessReferral | null): {
    agent_referral_agent_id?: string;
    agent_referral_business_id?: string;
    agent_referral_code_used?: string;
  } {
    if (!resolved) return {};
    if (resolved.kind === 'agent') {
      return {
        agent_referral_agent_id: resolved.agentId,
        agent_referral_code_used: resolved.normalizedCode,
      };
    }
    return {
      agent_referral_business_id: resolved.businessId,
      agent_referral_code_used: resolved.normalizedCode,
    };
  }

  async creditAfterFirstDelivery(
    referredAgentId: string,
    countryCode: string
  ): Promise<void> {
    if (!countryCode) return;
    if (await this.hasCreditedReferral(referredAgentId)) return;
    if (!(await this.hasCompletedDelivery(referredAgentId))) return;
    const context = await this.loadReferrerCreditContext(referredAgentId);
    if (!context) return;
    await this.creditResolvedAgentReferral(
      referredAgentId,
      context.resolved,
      countryCode,
      context.referredAgentName
    );
  }

  async creditResolvedAgentReferral(
    newAgentId: string,
    resolved: ResolvedBusinessReferral,
    countryCode: string,
    referredAgentName = 'Agent',
    options?: { swallowErrors?: boolean }
  ): Promise<void> {
    if (!countryCode) return;
    const throwOnFailure = options?.swallowErrors === false;
    try {
      if (resolved.kind === 'agent') {
        const earnerUserId = await this.getAgentUserId(resolved.agentId);
        await this.creditReferralChecked({
          referringAgentId: resolved.agentId,
          referrerBusinessId: null,
          referredAgentId: newAgentId,
          countryCode,
          referralCode: resolved.normalizedCode,
          referredAgentName,
          earnerName: `${resolved.userFirstName}`.trim() || 'Agent',
          earnerUserId,
          throwOnFailure,
        });
        return;
      }
      await this.creditReferralChecked({
        referringAgentId: null,
        referrerBusinessId: resolved.businessId,
        referredAgentId: newAgentId,
        countryCode,
        referralCode: resolved.normalizedCode,
        referredAgentName,
        earnerName: resolved.businessName || 'Business',
        earnerUserId: resolved.userId,
        throwOnFailure,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to credit agent referral for ${newAgentId}: ${error.message}`
      );
      if (throwOnFailure) throw error;
    }
  }

  private async creditReferralChecked(
    params: Parameters<AgentReferralsService['creditReferral']>[0]
  ): Promise<void> {
    const result = await this.creditReferral(params);
    if (params.throwOnFailure && !result.credited) {
      throw new Error(
        `Failed to credit agent referral for ${params.referredAgentId}`
      );
    }
  }

  async creditAgentReferralIfPresent(
    newAgentId: string,
    referralAgentCode?: string,
    countryCode?: string
  ): Promise<void> {
    const normalizedCode = referralAgentCode?.trim();
    if (!normalizedCode || !countryCode) {
      return;
    }

    const referringAgent = await this.findAgentByCode(normalizedCode);
    if (!referringAgent || referringAgent.status !== 'active') {
      return;
    }

    await this.creditAfterFirstDelivery(newAgentId, countryCode);
  }

  async creditReferral(params: {
    referringAgentId: string | null;
    referrerBusinessId: string | null;
    referredAgentId: string;
    countryCode: string;
    referralCode: string;
    referredAgentName: string;
    earnerName: string;
    earnerUserId: string | null;
    throwOnFailure?: boolean;
  }): Promise<{ credited: boolean; amount?: number }> {
    let referralId: string | null = null;
    try {
      const earnerId = params.referringAgentId || params.referrerBusinessId;
      if (!earnerId || !params.earnerUserId) {
        return { credited: false };
      }

      const config = await this.getReferralConfig(params.countryCode);
      const amountToCredit = await this.getReferralAmountToCredit(
        params.referringAgentId,
        config
      );
      if (amountToCredit <= 0) {
        return { credited: false };
      }

      const currency = this.getCurrencyForCountry(params.countryCode);
      referralId = await this.insertOrGetReferralRecord({
        referringAgentId: params.referringAgentId,
        referrerBusinessId: params.referrerBusinessId,
        referredAgentId: params.referredAgentId,
        referralCodeUsed: params.referralCode.trim().toUpperCase(),
        commissionAmount: amountToCredit,
      });
      if (!referralId) {
        return { credited: false };
      }

      const result = await this.referralPyramidService.distributeReferralBonus({
        grossAmount: amountToCredit,
        earner: {
          kind: params.referringAgentId ? 'agent' : 'business',
          id: earnerId,
          userId: params.earnerUserId,
          name: params.earnerName,
        },
        referred: {
          kind: 'agent',
          id: params.referredAgentId,
          name: params.referredAgentName,
        },
        preferPersonalAccount: Boolean(params.referringAgentId),
        currency,
        agentReferralId: referralId,
      });

      if (result.credited <= 0) {
        await this.deleteReferralRecord(referralId);
        return { credited: false };
      }

      return {
        credited: true,
        amount: amountToCredit,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to credit referral for agent ${params.referredAgentId}: ${error.message}`
      );
      if (referralId) await this.deleteReferralRecord(referralId);
      if (params.throwOnFailure) throw error;
      return { credited: false };
    }
  }

  private async hasCreditedReferral(referredAgentId: string): Promise<boolean> {
    const referralId = await this.findReferralIdByReferredAgent(referredAgentId);
    if (!referralId) return false;
    return this.hasPaidDistribution(referralId);
  }

  private async hasPaidDistribution(referralId: string): Promise<boolean> {
    const query = `
      query AgentReferralPaidDist($referralId: uuid!) {
        referral_bonus_distributions(
          where: {
            agent_referral_id: { _eq: $referralId }
            transaction_id: { _is_null: false }
          }
          limit: 1
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      referralId,
    });
    return Boolean(result?.referral_bonus_distributions?.[0]?.id);
  }

  private async hasCompletedDelivery(agentId: string): Promise<boolean> {
    const query = `
      query AgentCompletedDeliveries($agentId: uuid!) {
        orders_aggregate(
          where: {
            assigned_agent_id: { _eq: $agentId }
            current_status: { _in: ["complete", "delivered"] }
          }
        ) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId,
    });
    return (result?.orders_aggregate?.aggregate?.count ?? 0) > 0;
  }

  private async loadReferrerCreditContext(
    referredAgentId: string
  ): Promise<{
    resolved: ResolvedBusinessReferral;
    referredAgentName: string;
  } | null> {
    const row = await this.loadReferredAgentRow(referredAgentId);
    if (!row) return null;
    const referredAgentName =
      `${row.user?.first_name ?? ''} ${row.user?.last_name ?? ''}`.trim() ||
      'Agent';
    const resolved = this.resolvedReferrerFromRow(row);
    return resolved ? { resolved, referredAgentName } : null;
  }

  private async loadReferredAgentRow(agentId: string): Promise<any> {
    const query = `
      query ReferredAgentForCredit($agentId: uuid!) {
        agents_by_pk(id: $agentId) {
          referral_code_used
          user { first_name last_name }
          referring_agent {
            id
            user { first_name email preferred_language }
          }
          referring_business {
            id
            name
            user_id
            user { first_name email preferred_language }
          }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId,
    });
    return result?.agents_by_pk ?? null;
  }

  private resolvedReferrerFromRow(row: any): ResolvedBusinessReferral | null {
    const code = String(row.referral_code_used || '').trim().toUpperCase();
    if (!code) return null;
    if (row.referring_agent?.id) {
      return this.resolvedAgentReferrer(row.referring_agent, code);
    }
    if (row.referring_business?.id) {
      return this.resolvedBusinessReferrer(row.referring_business, code);
    }
    return null;
  }

  private resolvedAgentReferrer(
    agent: { id: string; user?: any },
    code: string
  ): ResolvedBusinessReferral {
    const user = agent.user || {};
    return {
      kind: 'agent',
      agentId: agent.id,
      normalizedCode: code,
      userEmail: user.email ?? '',
      userFirstName: user.first_name ?? '',
      preferredLanguage: user.preferred_language ?? 'en',
    };
  }

  private resolvedBusinessReferrer(
    business: { id: string; name?: string; user_id: string; user?: any },
    code: string
  ): ResolvedBusinessReferral {
    const user = business.user || {};
    return {
      kind: 'business',
      businessId: business.id,
      businessName: business.name || 'Business',
      normalizedCode: code,
      userId: business.user_id,
      userEmail: user.email ?? '',
      userFirstName: user.first_name ?? '',
      preferredLanguage: user.preferred_language ?? 'en',
    };
  }

  private async getAgentUserId(agentId: string): Promise<string | null> {
    const query = `
      query GetAgentUserId($agentId: uuid!) {
        agents_by_pk(id: $agentId) { user_id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId,
    });
    return result?.agents_by_pk?.user_id ?? null;
  }

  private async getReferralConfig(countryCode: string): Promise<ReferralConfig> {
    const defaults: ReferralConfig = {
      referralAmount: 1000,
      maxReferralTotal: 10000,
    };

    const query = `
      query GetAgentReferralConfigs($countryCode: String!) {
        application_configurations(
          where: {
            config_key: { _in: [
              "agent_referral_commission",
              "max_agent_referral_commission"
            ]},
            country_code: { _eq: $countryCode },
            status: { _eq: "active" }
          }
        ) {
          config_key
          number_value
        }
      }
    `;

    try {
      const response = await this.hasuraSystemService.executeQuery(query, {
        countryCode,
      });
      const configs = response.application_configurations || [];
      const map = configs.reduce((acc: Record<string, number>, cfg: any) => {
        acc[cfg.config_key] = Number(cfg.number_value);
        return acc;
      }, {});

      return {
        referralAmount:
          map.agent_referral_commission || defaults.referralAmount,
        maxReferralTotal:
          map.max_agent_referral_commission || defaults.maxReferralTotal,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to load referral config for ${countryCode}: ${error.message}`
      );
      return defaults;
    }
  }

  private async getReferralAmountToCredit(
    referringAgentId: string | null,
    config: ReferralConfig
  ): Promise<number> {
    if (config.referralAmount <= 0 || config.maxReferralTotal <= 0) {
      return 0;
    }
    if (!referringAgentId) {
      return config.referralAmount;
    }

    const currentTotal = await this.getTotalReferralCommission(referringAgentId);
    if (currentTotal >= config.maxReferralTotal) {
      return 0;
    }

    const remainingCap = config.maxReferralTotal - currentTotal;
    return Math.min(config.referralAmount, remainingCap);
  }

  private async getTotalReferralCommission(
    referringAgentId: string
  ): Promise<number> {
    const query = `
      query GetAgentReferralTotal($agentId: uuid!) {
        agent_referrals_aggregate(
          where: { referring_agent_id: { _eq: $agentId } }
        ) {
          aggregate {
            sum {
              commission_amount
            }
          }
        }
      }
    `;

    try {
      const result = await this.hasuraSystemService.executeQuery(query, {
        agentId: referringAgentId,
      });
      const sum =
        result.agent_referrals_aggregate?.aggregate?.sum
          ?.commission_amount ?? 0;
      return Number(sum) || 0;
    } catch (error: any) {
      this.logger.error(
        `Failed to load referral total for agent ${referringAgentId}: ${error.message}`
      );
      return 0;
    }
  }

  private getCurrencyForCountry(countryCode: string): string {
    const upper = (countryCode || '').toUpperCase();
    const currencyMap: Record<string, string> = {
      GA: 'XAF',
      CM: 'XAF',
      CA: 'CAD',
      US: 'USD',
    };
    return currencyMap[upper] || 'XAF';
  }

  private async insertOrGetReferralRecord(params: {
    referringAgentId: string | null;
    referrerBusinessId: string | null;
    referredAgentId: string;
    referralCodeUsed: string;
    commissionAmount: number;
  }): Promise<string | null> {
    const mutation = `
      mutation InsertAgentReferral($input: agent_referrals_insert_input!) {
        insert_agent_referrals_one(object: $input) {
          id
        }
      }
    `;

    const input = {
      referring_agent_id: params.referringAgentId,
      referrer_business_id: params.referrerBusinessId,
      referred_agent_id: params.referredAgentId,
      referral_code_used: params.referralCodeUsed,
      commission_amount: params.commissionAmount,
    };

    try {
      const result = await this.hasuraSystemService.executeMutation(mutation, {
        input,
      });
      return result?.insert_agent_referrals_one?.id ?? null;
    } catch (error: any) {
      const message = String(error?.message || error || '').toLowerCase();
      if (
        message.includes('uniqueness violation') ||
        message.includes('unique constraint') ||
        message.includes('uq_agent_referrals_referred_agent_id')
      ) {
        return this.findReferralIdByReferredAgent(params.referredAgentId);
      }
      throw error;
    }
  }

  private async findReferralIdByReferredAgent(
    referredAgentId: string
  ): Promise<string | null> {
    const query = `
      query AgentReferralByReferred($agentId: uuid!) {
        agent_referrals(
          where: { referred_agent_id: { _eq: $agentId } }
          limit: 1
        ) { id }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId: referredAgentId,
    });
    return result?.agent_referrals?.[0]?.id ?? null;
  }

  private async deleteReferralRecord(referralId: string): Promise<void> {
    const mutation = `
      mutation DeleteAgentReferral($id: uuid!) {
        delete_agent_referrals_by_pk(id: $id) { id }
      }
    `;
    try {
      await this.hasuraSystemService.executeMutation(mutation, {
        id: referralId,
      });
    } catch (error: any) {
      this.logger.warn(
        `Failed to delete unpaid agent referral ${referralId}: ${error.message}`
      );
    }
  }

  async listReferredBusinesses(
    agentId: string
  ): Promise<ReferredBusinessFollowUp[]> {
    const query = `
      query AgentReferredBusinesses($agentId: uuid!) {
        businesses(
          where: { referred_by_agent_id: { _eq: $agentId } }
          order_by: { created_at: desc }
        ) {
          ${REFERRED_BUSINESSES_LIST_SELECTION}
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery<{
      businesses: ReferredBusinessRow[];
    }>(query, { agentId });
    return mapReferredBusinesses(
      result?.businesses ?? [],
      'agent',
      (country) => this.readOnboardingMinSaleTotal(country)
    );
  }

  private async readOnboardingMinSaleTotal(
    country: string
  ): Promise<number | null> {
    try {
      const config = await this.configurationsService.getConfigurationByKey(
        ONBOARDING_10_MIN_SALE_TOTAL_KEY,
        country
      );
      const value = Number(config?.number_value);
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
      return null;
    }
  }

  async getReferredBusinessCount(agentId: string): Promise<number> {
    const query = `
      query AgentReferredBusinessCount($agentId: uuid!) {
        businesses_aggregate(
          where: { referred_by_agent_id: { _eq: $agentId } }
        ) {
          aggregate { count }
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId,
    });
    return result?.businesses_aggregate?.aggregate?.count ?? 0;
  }

  async getAgentCodeById(agentId: string): Promise<string | null> {
    const query = `
      query AgentCodeById($agentId: uuid!) {
        agents_by_pk(id: $agentId) {
          agent_code
        }
      }
    `;
    const result = await this.hasuraSystemService.executeQuery(query, {
      agentId,
    });
    return result?.agents_by_pk?.agent_code ?? null;
  }
}

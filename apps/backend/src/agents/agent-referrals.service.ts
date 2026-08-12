import { Injectable, Logger } from '@nestjs/common';
import type { ResolvedBusinessReferral } from '../business-referrals/business-referrals.service';
import {
  mapReferredBusinessRow,
  REFERRED_BUSINESSES_LIST_SELECTION,
  type ReferredBusinessFollowUp,
  type ReferredBusinessRow,
} from '../business-referrals/referred-business-followup.util';
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
    private readonly referralPyramidService: ReferralPyramidService
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

  async creditResolvedAgentReferral(
    newAgentId: string,
    resolved: ResolvedBusinessReferral,
    countryCode: string,
    referredAgentName = 'Agent'
  ): Promise<void> {
    if (!countryCode) return;
    try {
      if (resolved.kind === 'agent') {
        const earnerUserId = await this.getAgentUserId(resolved.agentId);
        await this.creditReferral({
          referringAgentId: resolved.agentId,
          referrerBusinessId: null,
          referredAgentId: newAgentId,
          countryCode,
          referralCode: resolved.normalizedCode,
          referredAgentName,
          earnerName: `${resolved.userFirstName}`.trim() || 'Agent',
          earnerUserId,
        });
        return;
      }
      await this.creditReferral({
        referringAgentId: null,
        referrerBusinessId: resolved.businessId,
        referredAgentId: newAgentId,
        countryCode,
        referralCode: resolved.normalizedCode,
        referredAgentName,
        earnerName: resolved.businessName || 'Business',
        earnerUserId: resolved.userId,
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to credit agent referral for ${newAgentId}: ${error.message}`
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

    await this.creditResolvedAgentReferral(
      newAgentId,
      {
        kind: 'agent',
        agentId: referringAgent.agentId,
        normalizedCode: normalizedCode.toUpperCase(),
        userEmail: referringAgent.userEmail,
        userFirstName: referringAgent.userFirstName,
        preferredLanguage: referringAgent.preferredLanguage,
      },
      countryCode
    );
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
  }): Promise<{ credited: boolean; amount?: number }> {
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
      const referralId = await this.insertOrGetReferralRecord({
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
      return { credited: false };
    }
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
      referralAmount: 500,
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
    return (result?.businesses ?? []).map(mapReferredBusinessRow);
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

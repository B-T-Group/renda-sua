import { Injectable, Logger } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

interface ReferralConfig {
  referralAmount: number;
  maxReferralTotal: number;
}

interface AgentLookupResult {
  agentId: string;
  userId: string;
  userFirstName: string;
  userLastName: string;
}

@Injectable()
export class AgentReferralsService {
  private readonly logger = new Logger(AgentReferralsService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly accountsService: AccountsService
  ) {}

  async findAgentByCode(agentCode: string): Promise<AgentLookupResult | null> {
    const normalizedCode = agentCode.trim().toUpperCase();
    if (!normalizedCode) {
      return null;
    }

    const query = `
      query FindAgentByCode($agentCode: String!) {
        agents(where: { agent_code: { _eq: $agentCode } }, limit: 1) {
          id
          user {
            id
            first_name
            last_name
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
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to find agent by code ${normalizedCode}: ${error.message}`
      );
      return null;
    }
  }

  async creditReferral(
    referringAgentId: string,
    referredAgentId: string,
    countryCode: string,
    referralCode: string
  ): Promise<{ credited: boolean; amount?: number }> {
    try {
      const config = await this.getReferralConfig(countryCode);
      const amountToCredit = await this.getReferralAmountToCredit(
        referringAgentId,
        config
      );
      if (amountToCredit <= 0) {
        return { credited: false };
      }

      const currency = this.getCurrencyForCountry(countryCode);
      const accountId = await this.getReferringAgentAccountId(
        referringAgentId,
        currency
      );
      if (!accountId) {
        this.logger.warn(
          `No active account found for referring agent ${referringAgentId}`
        );
        return { credited: false };
      }

      await this.accountsService.registerTransaction({
        accountId,
        amount: amountToCredit,
        transactionType: 'deposit',
        memo: 'Agent referral bonus',
        referenceId: referredAgentId,
      });

      await this.insertReferralRecord({
        referringAgentId,
        referredAgentId,
        referralCodeUsed: referralCode.trim().toUpperCase(),
        commissionAmount: amountToCredit,
      });

      return { credited: true, amount: amountToCredit };
    } catch (error: any) {
      this.logger.error(
        `Failed to credit referral for agent ${referringAgentId}: ${error.message}`
      );
      return { credited: false };
    }
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
      const map = configs.reduce((acc: any, cfg: any) => {
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
    referringAgentId: string,
    config: ReferralConfig
  ): Promise<number> {
    if (config.referralAmount <= 0 || config.maxReferralTotal <= 0) {
      return 0;
    }

    const currentTotal = await this.getTotalReferralCommission(
      referringAgentId
    );
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

  private async getReferringAgentAccountId(
    referringAgentId: string,
    currency: string
  ): Promise<string | null> {
    const agentQuery = `
      query GetAgentUserId($agentId: uuid!) {
        agents_by_pk(id: $agentId) {
          user_id
        }
      }
    `;

    const accountQuery = `
      query GetFirstActiveAccount($userId: uuid!, $currency: currency_enum!) {
        accounts(
          where: {
            user_id: { _eq: $userId },
            is_active: { _eq: true },
            currency: { _eq: $currency }
          },
          limit: 1
        ) {
          id
        }
      }
    `;

    try {
      const agentResult = await this.hasuraSystemService.executeQuery(
        agentQuery,
        { agentId: referringAgentId }
      );
      const userId = agentResult.agents_by_pk?.user_id;
      if (!userId) {
        return null;
      }

      const accountResult = await this.hasuraSystemService.executeQuery(
        accountQuery,
        { userId, currency }
      );
      const account = accountResult.accounts?.[0];
      return account?.id || null;
    } catch (error: any) {
      this.logger.error(
        `Failed to load account for referring agent ${referringAgentId}: ${error.message}`
      );
      return null;
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

  private async insertReferralRecord(params: {
    referringAgentId: string;
    referredAgentId: string;
    referralCodeUsed: string;
    commissionAmount: number;
  }): Promise<void> {
    const mutation = `
      mutation InsertAgentReferral($input: agent_referrals_insert_input!) {
        insert_agent_referrals_one(object: $input) {
          id
        }
      }
    `;

    const input = {
      referring_agent_id: params.referringAgentId,
      referred_agent_id: params.referredAgentId,
      referral_code_used: params.referralCodeUsed,
      commission_amount: params.commissionAmount,
    };

    await this.hasuraSystemService.executeMutation(mutation, {
      input,
    });
  }
}


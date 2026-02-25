import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';

export interface HoldPercentageConfig {
  internalAgentHoldPercentage: number;
  verifiedAgentHoldPercentage: number;
  unverifiedAgentHoldPercentage: number;
}

@Injectable()
export class AgentHoldService {
  private readonly logger = new Logger(AgentHoldService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly hasuraUserService: HasuraUserService
  ) {}

  /**
   * Fetch hold percentage configs from application_configurations
   */
  async getHoldPercentageConfigs(): Promise<HoldPercentageConfig> {
    const query = `
      query GetHoldPercentageConfigs {
        application_configurations(
          where: {
            config_key: { _in: [
              "internal_agent_hold_percentage",
              "verified_agent_hold_percentage",
              "unverified_agent_hold_percentage"
            ]}
          }
        ) {
          config_key
          number_value
        }
      }
    `;
    const response = await this.hasuraSystemService.executeQuery(query);
    const configs = response.application_configurations || [];
    const configMap = configs.reduce((acc: Record<string, number>, c: any) => {
      acc[c.config_key] = Number(c.number_value);
      return acc;
    }, {});

    return {
      internalAgentHoldPercentage:
        configMap.internal_agent_hold_percentage ?? 0,
      verifiedAgentHoldPercentage:
        configMap.verified_agent_hold_percentage ?? 80,
      unverifiedAgentHoldPercentage:
        configMap.unverified_agent_hold_percentage ?? 100,
    };
  }

  /**
   * Get hold percentage for the current user's agent, or for a given agentId
   */
  async getHoldPercentageForAgent(agentId?: string): Promise<number> {
    let isInternal = false;
    let isVerified = false;

    if (agentId) {
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        this.logger.warn(`Agent not found: ${agentId}, defaulting to unverified hold %`);
        const config = await this.getHoldPercentageConfigs();
        return config.unverifiedAgentHoldPercentage;
      }
      isInternal = !!agent.is_internal;
      isVerified = !!agent.is_verified;
    } else {
      const user = await this.hasuraUserService.getUser();
      if (!user?.agent) {
        this.logger.warn('No agent on user, defaulting to unverified hold %');
        const config = await this.getHoldPercentageConfigs();
        return config.unverifiedAgentHoldPercentage;
      }
      isInternal = !!user.agent.is_internal;
      isVerified = !!user.agent.is_verified;
    }

    const config = await this.getHoldPercentageConfigs();
    return this.getHoldPercentageFromConfig(
      { is_internal: isInternal, is_verified: isVerified },
      config
    );
  }

  /**
   * Sync version when caller already has agent flags and optionally config
   */
  getHoldPercentageForAgentSync(
    agent: { is_internal: boolean; is_verified: boolean },
    config?: HoldPercentageConfig
  ): number {
    if (config) {
      return this.getHoldPercentageFromConfig(agent, config);
    }
    return 0; // Caller must pass config for sync; fallback 0 is wrong for unverified
  }

  private getHoldPercentageFromConfig(
    agent: { is_internal: boolean; is_verified: boolean },
    config: HoldPercentageConfig
  ): number {
    if (agent.is_internal) return config.internalAgentHoldPercentage;
    if (agent.is_verified) return config.verifiedAgentHoldPercentage;
    return config.unverifiedAgentHoldPercentage;
  }

  private async getAgentById(agentId: string): Promise<{ is_internal: boolean; is_verified: boolean } | null> {
    const query = `
      query GetAgentById($id: uuid!) {
        agents_by_pk(id: $id) {
          is_internal
          is_verified
        }
      }
    `;
    const response = await this.hasuraSystemService.executeQuery(query, {
      id: agentId,
    });
    return response.agents_by_pk ?? null;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { HasuraUserService } from '../hasura/hasura-user.service';
import { isActivePersona } from '../users/persona.util';

export interface HoldPercentageConfig {
  internalAgentHoldPercentage: number;
  verifiedAgentHoldPercentage: number;
  unverifiedAgentHoldPercentage: number;
}

export interface HoldCeilingConfig {
  enabled: boolean;
  ceilingXaf: number | null;
  pilotCity: string | null;
  minCleanDeliveries: number;
  lossWeeklyCapXaf: number | null;
}

export interface HoldResolutionResult {
  rail: 'mobile_money' | 'stripe';
  holdPercentage: number;
  rawHoldAmount: number;
  holdAmount: number;
  ceilingApplied: boolean;
  ceilingXaf: number | null;
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
      if (!isActivePersona(user, 'agent') || !user.agent) {
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

  /**
   * Fetch hold ceiling configs from application_configurations
   * Cached at the AppConfig level (30s TTL)
   */
  async getHoldCeilingConfig(): Promise<HoldCeilingConfig> {
    const query = `
      query GetHoldCeilingConfigs {
        application_configurations(
          where: {
            config_key: { _in: [
              "agent_hold_ceiling_enabled",
              "agent_hold_ceiling_xaf",
              "agent_hold_ceiling_city",
              "agent_hold_ceiling_min_clean_deliveries",
              "agent_hold_loss_weekly_cap_xaf"
            ]}
            country_code: { _is_null: true }
          }
        ) {
          config_key
          boolean_value
          number_value
          string_value
        }
      }
    `;
    const response = await this.hasuraSystemService.executeQuery(query);
    const configs = response.application_configurations || [];
    const configMap = configs.reduce((acc: Record<string, any>, c: any) => {
      acc[c.config_key] = c;
      return acc;
    }, {});

    return {
      enabled: configMap.agent_hold_ceiling_enabled?.boolean_value ?? false,
      ceilingXaf: configMap.agent_hold_ceiling_xaf?.number_value ?? null,
      pilotCity: configMap.agent_hold_ceiling_city?.string_value ?? null,
      minCleanDeliveries: configMap.agent_hold_ceiling_min_clean_deliveries?.number_value ?? 10,
      lossWeeklyCapXaf: configMap.agent_hold_loss_weekly_cap_xaf?.number_value ?? null,
    };
  }

  /**
   * Check if agent is eligible for hold ceiling.
   * Eligibility requires ALL of:
   * - is_verified=true
   * - is_internal=false
   * - >= N PIN-confirmed completed deliveries (orders.current_status=complete AND
   *   delivery_pin_hash IS NOT NULL AND delivery_overwrite_code_used_at IS NULL,
   *   i.e. completed via the customer PIN, not the business overwrite code)
   * - zero failed_deliveries with resolution_type='agent_fault' (all-time)
   * - agent in pilot city: city of the agent's active primary address
   *   (agent_addresses -> addresses.is_primary), case/accent/whitespace-insensitive
   */
  async isAgentEligibleForCeiling(
    agentId: string,
    ceilingConfig: HoldCeilingConfig
  ): Promise<boolean> {
    if (!ceilingConfig.enabled) {
      return false;
    }

    const query = `
      query CheckAgentEligibility($agentId: uuid!) {
        agents_by_pk(id: $agentId) {
          is_verified
          is_internal
          primary_addresses: agent_addresses(
            where: {
              address: { is_primary: { _eq: true }, status: { _eq: active } }
            }
            limit: 1
          ) {
            address {
              city
            }
          }
        }
        completed_deliveries: orders_aggregate(
          where: {
            assigned_agent_id: { _eq: $agentId }
            current_status: { _eq: complete }
            delivery_pin_hash: { _is_null: false }
            delivery_overwrite_code_used_at: { _is_null: true }
          }
        ) {
          aggregate {
            count
          }
        }
        agent_faults: failed_deliveries_aggregate(
          where: {
            resolution_type: { _eq: agent_fault }
            order: { assigned_agent_id: { _eq: $agentId } }
          }
        ) {
          aggregate {
            count
          }
        }
      }
    `;

    const response = await this.hasuraSystemService.executeQuery(query, {
      agentId,
    });

    const agent = response.agents_by_pk;
    if (!agent) {
      return false;
    }

    if (!agent.is_verified || agent.is_internal) {
      return false;
    }

    const completedCount = response.completed_deliveries?.aggregate?.count ?? 0;
    if (completedCount < ceilingConfig.minCleanDeliveries) {
      return false;
    }

    const faultCount = response.agent_faults?.aggregate?.count ?? 0;
    if (faultCount > 0) {
      return false;
    }

    if (ceilingConfig.pilotCity) {
      const agentCity = agent.primary_addresses?.[0]?.address?.city;
      if (!agentCity) {
        return false;
      }
      const normalizedAgentCity = this.normalizeCity(agentCity);
      const normalizedPilotCity = this.normalizeCity(ceilingConfig.pilotCity);
      if (normalizedAgentCity !== normalizedPilotCity) {
        return false;
      }
    }

    return true;
  }

  /**
   * Normalize city string for comparison (lowercase, trim, remove accents)
   */
  private normalizeCity(city: string): string {
    return city
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Resolve hold amount with ceiling logic.
   * Used by open-orders list, claim-availability, claim, claim-with-topup, offer accept, offer enrich.
   * 
   * Hold calculation:
   * - rawHold = subtotal × holdPct / 100 (integer XAF math, existing rounding)
   * - stripe rail → 0
   * - internal agent → 0
   * - unverified → rawHold (100%)
   * - flag OFF or not eligible → rawHold (80%)
   * - else → min(rawHold, ceilingXaf)
   * 
   * Invariant: verified agent, subtotal>0, non-stripe ⇒ hold > 0
   * If ceilingXaf is missing/≤0/invalid, treat ceiling as not applicable (fall back to rawHold) — never zero.
   */
  async resolveOrderHoldWithCeiling(
    subtotal: number,
    agentId: string | null,
    rail: 'mobile_money' | 'stripe'
  ): Promise<HoldResolutionResult> {
    if (rail === 'stripe') {
      return {
        rail: 'stripe',
        holdPercentage: 0,
        rawHoldAmount: 0,
        holdAmount: 0,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    if (!agentId) {
      this.logger.warn('No agentId provided to resolveOrderHoldWithCeiling, using unverified hold %');
      const config = await this.getHoldPercentageConfigs();
      const holdPercentage = config.unverifiedAgentHoldPercentage;
      const rawHoldAmount = (subtotal * holdPercentage) / 100;
      return {
        rail,
        holdPercentage,
        rawHoldAmount,
        holdAmount: rawHoldAmount,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    const agent = await this.getAgentById(agentId);
    if (!agent) {
      this.logger.warn(`Agent not found: ${agentId}, using unverified hold %`);
      const config = await this.getHoldPercentageConfigs();
      const holdPercentage = config.unverifiedAgentHoldPercentage;
      const rawHoldAmount = (subtotal * holdPercentage) / 100;
      return {
        rail,
        holdPercentage,
        rawHoldAmount,
        holdAmount: rawHoldAmount,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    const config = await this.getHoldPercentageConfigs();
    const holdPercentage = this.getHoldPercentageFromConfig(agent, config);
    const rawHoldAmount = (subtotal * holdPercentage) / 100;

    if (agent.is_internal) {
      return {
        rail,
        holdPercentage: 0,
        rawHoldAmount: 0,
        holdAmount: 0,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    if (!agent.is_verified) {
      return {
        rail,
        holdPercentage,
        rawHoldAmount,
        holdAmount: rawHoldAmount,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    const ceilingConfig = await this.getHoldCeilingConfig();
    if (!ceilingConfig.enabled) {
      return {
        rail,
        holdPercentage,
        rawHoldAmount,
        holdAmount: rawHoldAmount,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    const isEligible = await this.isAgentEligibleForCeiling(agentId, ceilingConfig);
    if (!isEligible) {
      return {
        rail,
        holdPercentage,
        rawHoldAmount,
        holdAmount: rawHoldAmount,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    const ceilingXaf = ceilingConfig.ceilingXaf;
    if (!ceilingXaf || ceilingXaf <= 0) {
      return {
        rail,
        holdPercentage,
        rawHoldAmount,
        holdAmount: rawHoldAmount,
        ceilingApplied: false,
        ceilingXaf: null,
      };
    }

    const holdAmount = Math.min(rawHoldAmount, ceilingXaf);
    const ceilingApplied = holdAmount < rawHoldAmount;

    return {
      rail,
      holdPercentage,
      rawHoldAmount,
      holdAmount,
      ceilingApplied,
      ceilingXaf: ceilingApplied ? ceilingXaf : null,
    };
  }

  /**
   * Check weekly agent-fault loss cap and auto-disable ceiling if exceeded.
   * Loss amount = agent_hold_amount from order_holds for failed_deliveries with resolution_type='agent_fault'.
   * Rolling 7-day window from now.
   * When cap is configured >0 and exceeded, log/alert and set agent_hold_ceiling_enabled=false (idempotent).
   */
  async checkAndEnforceLossGuard(): Promise<{
    exceeded: boolean;
    weeklyLoss: number;
    cap: number | null;
    autoDisabled: boolean;
  }> {
    const ceilingConfig = await this.getHoldCeilingConfig();
    const cap = ceilingConfig.lossWeeklyCapXaf;

    if (!cap || cap <= 0) {
      return {
        exceeded: false,
        weeklyLoss: 0,
        cap: null,
        autoDisabled: false,
      };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const query = `
      query GetWeeklyAgentFaultLoss($cutoff: timestamptz!) {
        failed_deliveries(
          where: {
            resolution_type: { _eq: "agent_fault" }
            resolved_at: { _gte: $cutoff }
          }
        ) {
          order_id
        }
      }
    `;

    const response = await this.hasuraSystemService.executeQuery(query, {
      cutoff: sevenDaysAgo.toISOString(),
    });

    const orderIds = (response.failed_deliveries || []).map((fd: any) => fd.order_id);

    if (orderIds.length === 0) {
      return {
        exceeded: false,
        weeklyLoss: 0,
        cap,
        autoDisabled: false,
      };
    }

    const holdsQuery = `
      query GetAgentHoldAmounts($orderIds: [uuid!]!) {
        order_holds(where: { order_id: { _in: $orderIds } }) {
          agent_hold_amount
        }
      }
    `;

    const holdsResponse = await this.hasuraSystemService.executeQuery(holdsQuery, {
      orderIds,
    });

    const weeklyLoss = (holdsResponse.order_holds || []).reduce(
      (sum: number, hold: any) => sum + (hold.agent_hold_amount || 0),
      0
    );

    const exceeded = weeklyLoss > cap;

    let autoDisabled = false;
    if (exceeded && ceilingConfig.enabled) {
      this.logger.warn(
        `Weekly agent-fault loss (${weeklyLoss} XAF) exceeds cap (${cap} XAF). Auto-disabling agent_hold_ceiling.`
      );

      const mutation = `
        mutation DisableHoldCeiling {
          update_application_configurations(
            where: {
              config_key: { _eq: "agent_hold_ceiling_enabled" }
              boolean_value: { _eq: true }
            }
            _set: { boolean_value: false }
          ) {
            affected_rows
          }
        }
      `;

      await this.hasuraSystemService.executeMutation(mutation, {});
      autoDisabled = true;
    }

    return {
      exceeded,
      weeklyLoss,
      cap,
      autoDisabled,
    };
  }
}

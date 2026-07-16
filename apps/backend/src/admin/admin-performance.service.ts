import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  AGENTS_BY_IDS_QUERY,
  MARKETS_QUERY,
  buildDeliveryAgentsQuery,
  buildReferredBusinessesQuery,
  buildSummaryQuery,
} from './admin-performance.queries';
import type { TopAgentMetric } from './dto/admin-performance-query.dto';

export interface PerformanceWindowParams {
  from: string;
  to: string;
  countryCode?: string;
}

export interface PerformanceSummary {
  countryCode: string | null;
  from: string;
  to: string;
  businessesEnrolled: number;
  clientsAdded: number;
  agentsAdded: number;
  saleItemsAdded: number;
  rentalItemsAdded: number;
}

export interface TopAgentEntry {
  agentId: string;
  agentCode: string | null;
  firstName: string;
  lastName: string;
  count: number;
}

interface AggregateCount {
  aggregate: { count: number } | null;
}

interface SummaryQueryResult {
  businesses_aggregate: AggregateCount;
  clients_aggregate: AggregateCount;
  agents_aggregate: AggregateCount;
  items_aggregate: AggregateCount;
  rental_items_aggregate: AggregateCount;
}

interface AgentRow {
  id: string;
  agent_code: string | null;
  user: { first_name: string | null; last_name: string | null } | null;
}

interface MarketRow {
  country_code: string;
  country_name: string;
}

interface DeliveryAgentRow extends AgentRow {
  orders_aggregate: AggregateCount;
}

interface DeliveryAgentsQueryResult {
  agents: DeliveryAgentRow[];
}

interface ReferredBusinessesQueryResult {
  businesses: { referred_by_agent_id: string }[];
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

@Injectable()
export class AdminPerformanceService {
  private readonly logger = new Logger(AdminPerformanceService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getSummary(
    params: PerformanceWindowParams
  ): Promise<PerformanceSummary> {
    const query = buildSummaryQuery(Boolean(params.countryCode));
    const result =
      await this.hasuraSystemService.executeQuery<SummaryQueryResult>(
        query,
        this.windowVariables(params)
      );
    return {
      countryCode: params.countryCode ?? null,
      from: params.from,
      to: params.to,
      businessesEnrolled: this.count(result?.businesses_aggregate),
      clientsAdded: this.count(result?.clients_aggregate),
      agentsAdded: this.count(result?.agents_aggregate),
      saleItemsAdded: this.count(result?.items_aggregate),
      rentalItemsAdded: this.count(result?.rental_items_aggregate),
    };
  }

  async getTopAgents(
    params: PerformanceWindowParams,
    metric: TopAgentMetric,
    limit: number
  ): Promise<TopAgentEntry[]> {
    if (metric === 'deliveries') {
      const entries = await this.collectDeliveryAgents(params);
      return entries.sort((a, b) => b.count - a.count).slice(0, limit);
    }
    return this.topReferralAgents(params, limit);
  }

  async getMarkets(): Promise<{ countryCode: string; countryName: string }[]> {
    const result = await this.hasuraSystemService.executeQuery<{
      supported_country_states: MarketRow[];
    }>(MARKETS_QUERY);
    return (result?.supported_country_states ?? []).map((row) => ({
      countryCode: row.country_code,
      countryName: row.country_name,
    }));
  }

  /**
   * Pages over agents (not raw orders) with a filtered orders_aggregate,
   * so counts stay exact regardless of order volume in the window.
   */
  private async collectDeliveryAgents(
    params: PerformanceWindowParams
  ): Promise<TopAgentEntry[]> {
    const query = buildDeliveryAgentsQuery(Boolean(params.countryCode));
    const entries: TopAgentEntry[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const result =
        await this.hasuraSystemService.executeQuery<DeliveryAgentsQueryResult>(
          query,
          {
            ...this.windowVariables(params),
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          }
        );
      const agents = result?.agents ?? [];
      agents.forEach((agent) =>
        entries.push(
          this.toTopAgentEntry(agent.id, this.count(agent.orders_aggregate), agent)
        )
      );
      if (agents.length < PAGE_SIZE) return entries;
    }
    this.logger.warn(
      `Delivery agents pagination cap reached (${MAX_PAGES * PAGE_SIZE} agents)`
    );
    return entries;
  }

  private async topReferralAgents(
    params: PerformanceWindowParams,
    limit: number
  ): Promise<TopAgentEntry[]> {
    const counts = await this.countBusinessReferralsByAgent(params);
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    if (ranked.length === 0) return [];
    const agents = await this.fetchAgentsByIds(ranked.map(([id]) => id));
    return ranked.map(([agentId, count]) =>
      this.toTopAgentEntry(agentId, count, agents.get(agentId))
    );
  }

  private async countBusinessReferralsByAgent(
    params: PerformanceWindowParams
  ): Promise<Map<string, number>> {
    const query = buildReferredBusinessesQuery(Boolean(params.countryCode));
    return this.pageAndCount<ReferredBusinessesQueryResult>(
      query,
      params,
      (result) =>
        (result?.businesses ?? []).map((row) => row.referred_by_agent_id)
    );
  }

  private async pageAndCount<T>(
    query: string,
    params: PerformanceWindowParams,
    extractAgentIds: (result: T) => string[]
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await this.hasuraSystemService.executeQuery<T>(query, {
        ...this.windowVariables(params),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      const agentIds = extractAgentIds(result);
      agentIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
      if (agentIds.length < PAGE_SIZE) return counts;
    }
    this.logger.warn(
      `Top-agents pagination cap reached (${MAX_PAGES * PAGE_SIZE} rows)`
    );
    return counts;
  }

  private async fetchAgentsByIds(
    ids: string[]
  ): Promise<Map<string, AgentRow>> {
    const result = await this.hasuraSystemService.executeQuery<{
      agents: AgentRow[];
    }>(AGENTS_BY_IDS_QUERY, { ids });
    return new Map((result?.agents ?? []).map((agent) => [agent.id, agent]));
  }

  private toTopAgentEntry(
    agentId: string,
    count: number,
    agent?: AgentRow
  ): TopAgentEntry {
    return {
      agentId,
      agentCode: agent?.agent_code ?? null,
      firstName: agent?.user?.first_name ?? '',
      lastName: agent?.user?.last_name ?? '',
      count,
    };
  }

  private windowVariables(params: PerformanceWindowParams): {
    from: string;
    to: string;
    country?: string;
  } {
    const variables: { from: string; to: string; country?: string } = {
      from: params.from,
      to: params.to,
    };
    if (params.countryCode) variables.country = params.countryCode;
    return variables;
  }

  private count(aggregate?: AggregateCount): number {
    return aggregate?.aggregate?.count ?? 0;
  }
}

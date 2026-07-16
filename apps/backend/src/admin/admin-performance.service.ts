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

/** Target catalog depth: average sale items per referred business. */
export const GOLDEN_ITEMS_PER_REFERRAL = 10;

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
  /** Sale catalog items across referred businesses (referrals metric only). */
  inventoryItemsCount?: number;
  /** inventoryItemsCount / count, one decimal. */
  itemsPerReferral?: number;
  /** Referred businesses that currently have ≥ golden items. */
  stockedReferralCount?: number;
  meetsGoldenRatio?: boolean;
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

interface ReferredBusinessRow {
  referred_by_agent_id: string;
  items_aggregate: AggregateCount;
}

interface ReferredBusinessesQueryResult {
  businesses: ReferredBusinessRow[];
}

interface ReferralAgg {
  referrals: number;
  inventoryItems: number;
  stockedReferrals: number;
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
    limit: number,
    minItemsPerReferral?: number
  ): Promise<TopAgentEntry[]> {
    if (metric === 'deliveries') {
      const entries = await this.collectDeliveryAgents(params);
      return entries.sort((a, b) => b.count - a.count).slice(0, limit);
    }
    return this.topReferralAgents(params, limit, minItemsPerReferral);
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
    limit: number,
    minItemsPerReferral?: number
  ): Promise<TopAgentEntry[]> {
    const aggs = await this.aggregateReferralsByAgent(params);
    let entries = [...aggs.entries()].map(([agentId, agg]) =>
      this.toReferralEntry(agentId, agg)
    );
    const goldenFilter = minItemsPerReferral != null;
    if (goldenFilter) {
      entries = entries.filter((e) =>
        this.rawItemsPerReferral(e) >= minItemsPerReferral
      );
    }
    entries.sort((a, b) =>
      this.compareReferralEntries(a, b, goldenFilter)
    );
    const ranked = entries.slice(0, limit);
    if (ranked.length === 0) return [];
    const agents = await this.fetchAgentsByIds(ranked.map((e) => e.agentId));
    return ranked.map((entry) =>
      this.withAgentNames(entry, agents.get(entry.agentId))
    );
  }

  private rawItemsPerReferral(entry: TopAgentEntry): number {
    if (entry.count <= 0) return 0;
    return (entry.inventoryItemsCount ?? 0) / entry.count;
  }

  private compareReferralEntries(
    a: TopAgentEntry,
    b: TopAgentEntry,
    preferItemsPerReferral: boolean
  ): number {
    if (preferItemsPerReferral) {
      const byItems =
        this.rawItemsPerReferral(b) - this.rawItemsPerReferral(a);
      if (byItems !== 0) return byItems;
      return b.count - a.count;
    }
    const byCount = b.count - a.count;
    if (byCount !== 0) return byCount;
    return this.rawItemsPerReferral(b) - this.rawItemsPerReferral(a);
  }

  private toReferralEntry(agentId: string, agg: ReferralAgg): TopAgentEntry {
    const rawRatio =
      agg.referrals > 0 ? agg.inventoryItems / agg.referrals : 0;
    const itemsPerReferral = Math.round(rawRatio * 10) / 10;
    return {
      agentId,
      agentCode: null,
      firstName: '',
      lastName: '',
      count: agg.referrals,
      inventoryItemsCount: agg.inventoryItems,
      itemsPerReferral,
      stockedReferralCount: agg.stockedReferrals,
      meetsGoldenRatio: rawRatio >= GOLDEN_ITEMS_PER_REFERRAL,
    };
  }

  private withAgentNames(
    entry: TopAgentEntry,
    agent?: AgentRow
  ): TopAgentEntry {
    return {
      ...entry,
      agentCode: agent?.agent_code ?? null,
      firstName: agent?.user?.first_name ?? '',
      lastName: agent?.user?.last_name ?? '',
    };
  }

  private async aggregateReferralsByAgent(
    params: PerformanceWindowParams
  ): Promise<Map<string, ReferralAgg>> {
    const query = buildReferredBusinessesQuery(Boolean(params.countryCode));
    const aggs = new Map<string, ReferralAgg>();
    for (let page = 0; page < MAX_PAGES; page++) {
      const result =
        await this.hasuraSystemService.executeQuery<ReferredBusinessesQueryResult>(
          query,
          {
            ...this.windowVariables(params),
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
          }
        );
      const rows = result?.businesses ?? [];
      rows.forEach((row) => this.addReferralRow(aggs, row));
      if (rows.length < PAGE_SIZE) return aggs;
    }
    this.logger.warn(
      `Top-agents pagination cap reached (${MAX_PAGES * PAGE_SIZE} rows)`
    );
    return aggs;
  }

  private addReferralRow(
    aggs: Map<string, ReferralAgg>,
    row: ReferredBusinessRow
  ): void {
    const agentId = row.referred_by_agent_id;
    if (!agentId) return;
    const itemCount = this.count(row.items_aggregate);
    const current = aggs.get(agentId) ?? {
      referrals: 0,
      inventoryItems: 0,
      stockedReferrals: 0,
    };
    current.referrals += 1;
    current.inventoryItems += itemCount;
    if (itemCount >= GOLDEN_ITEMS_PER_REFERRAL) {
      current.stockedReferrals += 1;
    }
    aggs.set(agentId, current);
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

import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  groupEarnedByAgent,
  primaryEarned,
  type AgentEarnedTotals,
  type CompensationEarningRow,
} from './admin-performance-earnings.util';
import {
  AGENTS_BY_IDS_QUERY,
  MARKETS_QUERY,
  buildAgentEarningsQuery,
  buildAgentPendingEventsQuery,
  buildDeliveryAgentsQuery,
  buildReferredBusinessesQuery,
  buildSummaryQuery,
} from './admin-performance.queries';
import { BusinessReferralReviewService } from './business-referral-review.service';
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

export interface ReferredBusinessSummary {
  businessId: string;
  businessName: string;
  itemCount: number;
  /** itemCount + 1 */
  score: number;
  createdAt: string;
  payoutReviewStatus?: 'pending' | 'approved' | 'rejected';
  payoutReviewRejectionReason?: string | null;
  isPaid?: boolean;
  /** Credited compensation for this shop in the selected window. */
  earnedAmount?: number;
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
  /** sum(itemCount + 1) over referred businesses. */
  score?: number;
  referredBusinesses?: ReferredBusinessSummary[];
  /** Sum of pending representative_compensation_events (Saturday onboarding credit). */
  projectedPayoutAmount?: number;
  projectedPayoutCurrency?: string;
  /** Credited representative compensation in the selected window. */
  earnedAmount?: number;
  earnedCurrency?: string;
  /** True when the agent's user has users.internal (higher referral commission). */
  isInternal?: boolean;
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
  user: {
    first_name: string | null;
    last_name: string | null;
    internal?: boolean | null;
  } | null;
  agent_addresses?: Array<{ address: { country: string | null } }>;
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
  id: string;
  name: string;
  created_at: string;
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
  score: number;
  businesses: ReferredBusinessSummary[];
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

@Injectable()
export class AdminPerformanceService {
  private readonly logger = new Logger(AdminPerformanceService.name);

  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly referralReviewService: BusinessReferralReviewService
  ) {}

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
    entries.sort((a, b) => this.compareReferralEntries(a, b));
    const ranked = entries.slice(0, limit);
    if (ranked.length === 0) return [];
    const withReviews = await this.attachReferralReviewStatuses(ranked);
    const agents = await this.fetchAgentsByIds(
      withReviews.map((e) => e.agentId)
    );
    const withNames = withReviews.map((entry) =>
      this.withAgentNames(entry, agents.get(entry.agentId))
    );
    const withPending = await this.attachPendingAmounts(withNames, params);
    return this.attachEarnedAmounts(withPending, params);
  }

  private async attachReferralReviewStatuses(
    entries: TopAgentEntry[]
  ): Promise<TopAgentEntry[]> {
    const businessIds = entries.flatMap((e) =>
      (e.referredBusinesses ?? []).map((b) => b.businessId)
    );
    const statuses =
      await this.referralReviewService.getReviewStatusesForBusinessIds(
        businessIds
      );
    return entries.map((entry) => this.withReviewStatuses(entry, statuses));
  }

  private withReviewStatuses(
    entry: TopAgentEntry,
    statuses: Map<
      string,
      {
        payoutReviewStatus: 'pending' | 'approved' | 'rejected';
        rejectionReason: string | null;
        isPaid: boolean;
      }
    >
  ): TopAgentEntry {
    const businesses = (entry.referredBusinesses ?? []).map((biz) => {
      const st = statuses.get(biz.businessId);
      return {
        ...biz,
        payoutReviewStatus: st?.payoutReviewStatus ?? 'pending',
        payoutReviewRejectionReason: st?.rejectionReason ?? null,
        isPaid: st?.isPaid ?? false,
      };
    });
    return { ...entry, referredBusinesses: businesses };
  }

  private async attachPendingAmounts(
    entries: TopAgentEntry[],
    params: PerformanceWindowParams
  ): Promise<TopAgentEntry[]> {
    if (entries.length === 0) return entries;
    const rows = await this.loadPendingEvents(
      entries.map((entry) => entry.agentId),
      params
    );
    const totals = groupEarnedByAgent(rows);
    return entries.map((entry) => this.withPending(entry, totals.get(entry.agentId)));
  }

  private async loadPendingEvents(
    agentIds: string[],
    params: PerformanceWindowParams
  ): Promise<CompensationEarningRow[]> {
    const query = buildAgentPendingEventsQuery(Boolean(params.countryCode));
    const rows: CompensationEarningRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const pageRows = await this.fetchPendingPage(query, agentIds, params, page);
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) return rows;
    }
    this.logger.warn(
      `Agent pending events pagination cap reached (${MAX_PAGES * PAGE_SIZE} rows)`
    );
    return rows;
  }

  private async fetchPendingPage(
    query: string,
    agentIds: string[],
    params: PerformanceWindowParams,
    page: number
  ): Promise<CompensationEarningRow[]> {
    const variables: Record<string, unknown> = {
      agentIds,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (params.countryCode) variables.country = params.countryCode;
    const result = await this.hasuraSystemService.executeQuery<{
      representative_compensation_events: CompensationEarningRow[];
    }>(query, variables);
    return result?.representative_compensation_events ?? [];
  }

  private withPending(
    entry: TopAgentEntry,
    totals?: AgentEarnedTotals
  ): TopAgentEntry {
    const primary = primaryEarned(totals);
    if (primary.amount <= 0) return entry;
    return {
      ...entry,
      projectedPayoutAmount: primary.amount,
      projectedPayoutCurrency: primary.currency,
    };
  }

  private async attachEarnedAmounts(
    entries: TopAgentEntry[],
    params: PerformanceWindowParams
  ): Promise<TopAgentEntry[]> {
    if (entries.length === 0) return entries;
    const rows = await this.loadEarnedEvents(
      entries.map((entry) => entry.agentId),
      params
    );
    const totals = groupEarnedByAgent(rows);
    return entries.map((entry) => this.withEarned(entry, totals.get(entry.agentId)));
  }

  private async loadEarnedEvents(
    agentIds: string[],
    params: PerformanceWindowParams
  ): Promise<CompensationEarningRow[]> {
    const query = buildAgentEarningsQuery(Boolean(params.countryCode));
    const rows: CompensationEarningRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const pageRows = await this.fetchEarnedPage(query, agentIds, params, page);
      rows.push(...pageRows);
      if (pageRows.length < PAGE_SIZE) return rows;
    }
    this.logger.warn(
      `Agent earnings pagination cap reached (${MAX_PAGES * PAGE_SIZE} rows)`
    );
    return rows;
  }

  private async fetchEarnedPage(
    query: string,
    agentIds: string[],
    params: PerformanceWindowParams,
    page: number
  ): Promise<CompensationEarningRow[]> {
    const result = await this.hasuraSystemService.executeQuery<{
      representative_compensation_events: CompensationEarningRow[];
    }>(query, {
      ...this.windowVariables(params),
      agentIds,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    return result?.representative_compensation_events ?? [];
  }

  private withEarned(
    entry: TopAgentEntry,
    totals?: AgentEarnedTotals
  ): TopAgentEntry {
    const primary = primaryEarned(totals);
    const currency =
      primary.amount > 0
        ? primary.currency
        : entry.projectedPayoutCurrency || primary.currency;
    return {
      ...entry,
      earnedAmount: primary.amount,
      earnedCurrency: currency,
      referredBusinesses: (entry.referredBusinesses ?? []).map((biz) => ({
        ...biz,
        earnedAmount: totals?.byBusiness.get(biz.businessId) ?? 0,
      })),
    };
  }

  private rawItemsPerReferral(entry: TopAgentEntry): number {
    if (entry.count <= 0) return 0;
    return (entry.inventoryItemsCount ?? 0) / entry.count;
  }

  private compareReferralEntries(
    a: TopAgentEntry,
    b: TopAgentEntry
  ): number {
    const byScore = (b.score ?? 0) - (a.score ?? 0);
    if (byScore !== 0) return byScore;
    return b.count - a.count;
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
      score: agg.score,
      referredBusinesses: [...agg.businesses].sort(
        (x, y) => y.itemCount - x.itemCount
      ),
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
      isInternal: agent?.user?.internal === true,
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
      score: 0,
      businesses: [],
    };
    current.referrals += 1;
    current.inventoryItems += itemCount;
    current.score += itemCount + 1;
    current.businesses.push({
      businessId: row.id,
      businessName: row.name,
      itemCount,
      score: itemCount + 1,
      createdAt: row.created_at,
    });
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

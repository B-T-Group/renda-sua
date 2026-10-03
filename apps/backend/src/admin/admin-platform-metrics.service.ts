import { Injectable, Logger } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import type { PerformanceWindowParams } from './admin-performance.service';
import {
  buildOrderCurrenciesQuery,
  buildOrderMetricsQuery,
  buildPayoutAggregatesQuery,
  buildPayoutCurrenciesQuery,
  buildTopStoresQuery,
} from './admin-platform-metrics.queries';

const TOP_STORE_LIMIT = 5;
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const CURRENCY_CODE = /^[A-Z]{3}$/;

export interface PlatformOrderMetrics {
  total: number;
  completed: number;
  cancelled: number;
  /** Terminal failed deliveries, kept out of inProgress. */
  failed: number;
  refunds: number;
  inProgress: number;
  pendingPayment: number;
  /** Completed / total, percent with one decimal. */
  completionRate: number;
  /** Cancelled / total, percent with one decimal. */
  cancellationRate: number;
  uniqueClients: number;
  byFulfillment: { delivery: number; pickup: number; shipping: number };
}

export interface PlatformSalesRow {
  currency: string;
  /** Sum of total_amount on completed orders. */
  gmv: number;
  /** Sum of total_amount on orders with payment_status paid. */
  collected: number;
  completedCount: number;
  averageOrderValue: number;
}

export interface PlatformPayoutRow {
  currency: string;
  /** HQ share of item and delivery commissions, excluding funded-delivery debits. */
  platformRevenue: number;
  agentDeliveryPay: number;
  partnerCommissions: number;
  /** Merchant share of the order subtotal credited to the business. */
  merchantPayouts: number;
  /** HQ debit that funds the agent when the delivery fee was waived. */
  platformFundedDelivery: number;
  /** Credited representative compensation plus one-time referral bonuses. */
  referralCompensation: number;
}

export interface TopStoreReferrer {
  kind: 'agent' | 'business';
  name: string;
  code: string | null;
}

export interface TopStoreRow {
  businessLocationId: string;
  locationName: string;
  businessId: string;
  businessName: string;
  orderCount: number;
  completedCount: number;
  gmv: number;
  currency: string;
  referrer: TopStoreReferrer | null;
}

export interface PlatformMetrics {
  orders: PlatformOrderMetrics;
  sales: PlatformSalesRow[];
  payouts: PlatformPayoutRow[];
  topStores: TopStoreRow[];
}

interface AggBlock {
  aggregate: {
    count?: number;
    sum?: { total_amount?: unknown; amount?: unknown } | null;
  } | null;
}

type AggMap = Record<string, AggBlock | undefined>;

interface CurrencyRow {
  currency: string;
}

interface PayoutCurrencyResult {
  commission_payouts: CurrencyRow[];
  representative_compensation_events: CurrencyRow[];
  business_referral_payouts: CurrencyRow[];
}

interface StoreAgent {
  agent_code: string | null;
  user: { first_name: string | null; last_name: string | null } | null;
}

interface StoreBusiness {
  id: string;
  name: string;
  referring_agent: StoreAgent | null;
  referring_business: { name: string; business_code: string | null } | null;
}

interface StoreLocationRow {
  id: string;
  name: string;
  business: StoreBusiness | null;
  orders_aggregate: AggBlock;
  completed: AggBlock;
  orders: Array<{ currency: string }>;
}

@Injectable()
export class AdminPlatformMetricsService {
  private readonly logger = new Logger(AdminPlatformMetricsService.name);

  constructor(private readonly hasuraSystemService: HasuraSystemService) {}

  async getPlatformMetrics(
    params: PerformanceWindowParams
  ): Promise<PlatformMetrics> {
    const [ordersAndSales, payouts, topStores] = await Promise.all([
      this.loadOrdersAndSales(params),
      this.loadPayouts(params),
      this.loadTopStores(params),
    ]);
    return {
      orders: ordersAndSales.orders,
      sales: ordersAndSales.sales,
      payouts,
      topStores,
    };
  }

  private async loadOrdersAndSales(
    params: PerformanceWindowParams
  ): Promise<{ orders: PlatformOrderMetrics; sales: PlatformSalesRow[] }> {
    const currencies = await this.fetchOrderCurrencies(params);
    const result = await this.fetchOrderMetrics(params, currencies);
    return {
      orders: this.toOrderMetrics(result),
      sales: currencies.map((currency) => this.salesRow(result, currency)),
    };
  }

  private async fetchOrderCurrencies(
    params: PerformanceWindowParams
  ): Promise<string[]> {
    const query = buildOrderCurrenciesQuery(Boolean(params.countryCode));
    const result = await this.hasuraSystemService.executeQuery<{
      orders: CurrencyRow[];
    }>(query, this.windowVariables(params));
    return this.cleanCurrencies(result?.orders ?? []);
  }

  private async fetchOrderMetrics(
    params: PerformanceWindowParams,
    currencies: string[]
  ): Promise<AggMap> {
    const query = buildOrderMetricsQuery(
      Boolean(params.countryCode),
      currencies
    );
    const result = await this.hasuraSystemService.executeQuery<AggMap>(
      query,
      { ...this.windowVariables(params), ...this.currencyVariables(currencies) }
    );
    return result ?? {};
  }

  private toOrderMetrics(result: AggMap): PlatformOrderMetrics {
    const total = this.countOf(result.total);
    const completed = this.countOf(result.completed);
    const cancelled = this.countOf(result.cancelled);
    const failed = this.countOf(result.failed);
    const refunds = this.countOf(result.refunds);
    const pendingPayment = this.countOf(result.pendingPayment);
    const settled = completed + cancelled + failed + refunds + pendingPayment;
    return {
      total,
      completed,
      cancelled,
      failed,
      refunds,
      pendingPayment,
      inProgress: Math.max(0, total - settled),
      completionRate: this.rate(completed, total),
      cancellationRate: this.rate(cancelled, total),
      uniqueClients: this.countOf(result.uniqueClients),
      byFulfillment: this.fulfillmentCounts(result),
    };
  }

  private fulfillmentCounts(
    result: AggMap
  ): PlatformOrderMetrics['byFulfillment'] {
    return {
      delivery: this.countOf(result.delivery),
      pickup: this.countOf(result.pickup),
      shipping: this.countOf(result.shipping),
    };
  }

  private salesRow(result: AggMap, currency: string): PlatformSalesRow {
    const gmv = this.sumOf(result[`gmv_${currency}`], 'total_amount');
    const completedCount = this.countOf(result[`gmv_${currency}`]);
    return {
      currency,
      gmv,
      collected: this.sumOf(result[`collected_${currency}`], 'total_amount'),
      completedCount,
      averageOrderValue: this.average(gmv, completedCount),
    };
  }

  private async loadPayouts(
    params: PerformanceWindowParams
  ): Promise<PlatformPayoutRow[]> {
    const currencies = await this.fetchPayoutCurrencies(params);
    if (currencies.length === 0) return [];
    const result = await this.fetchPayoutAggregates(params, currencies);
    return currencies.map((currency) => this.payoutRow(result, currency));
  }

  private async fetchPayoutCurrencies(
    params: PerformanceWindowParams
  ): Promise<string[]> {
    const query = buildPayoutCurrenciesQuery(Boolean(params.countryCode));
    const result =
      await this.hasuraSystemService.executeQuery<PayoutCurrencyResult>(
        query,
        this.windowVariables(params)
      );
    return this.cleanCurrencies(this.payoutCurrencyRows(result));
  }

  private payoutCurrencyRows(result?: PayoutCurrencyResult): CurrencyRow[] {
    return [
      ...(result?.commission_payouts ?? []),
      ...(result?.representative_compensation_events ?? []),
      ...(result?.business_referral_payouts ?? []),
    ];
  }

  private async fetchPayoutAggregates(
    params: PerformanceWindowParams,
    currencies: string[]
  ): Promise<AggMap> {
    const query = buildPayoutAggregatesQuery(
      Boolean(params.countryCode),
      currencies
    );
    const result = await this.hasuraSystemService.executeQuery<AggMap>(
      query,
      { ...this.windowVariables(params), ...this.currencyVariables(currencies) }
    );
    return result ?? {};
  }

  private payoutRow(result: AggMap, currency: string): PlatformPayoutRow {
    const referral =
      this.sumOf(result[`comp_${currency}`], 'amount') +
      this.sumOf(result[`bonus_${currency}`], 'amount');
    return {
      currency,
      platformRevenue: this.sumOf(result[`platform_${currency}`], 'amount'),
      agentDeliveryPay: this.sumOf(result[`agent_${currency}`], 'amount'),
      partnerCommissions: this.sumOf(result[`partner_${currency}`], 'amount'),
      merchantPayouts: this.sumOf(result[`merchant_${currency}`], 'amount'),
      platformFundedDelivery: this.sumOf(result[`subsidy_${currency}`], 'amount'),
      referralCompensation: this.roundMoney(referral),
    };
  }

  private async loadTopStores(
    params: PerformanceWindowParams
  ): Promise<TopStoreRow[]> {
    const rows = await this.collectStoreRows(params);
    return [...rows]
      .sort((a, b) => b.orderCount - a.orderCount || b.gmv - a.gmv)
      .slice(0, TOP_STORE_LIMIT);
  }

  private async collectStoreRows(
    params: PerformanceWindowParams
  ): Promise<TopStoreRow[]> {
    const query = buildTopStoresQuery(Boolean(params.countryCode));
    const rows: TopStoreRow[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const pageRows = await this.fetchStorePage(query, params, page);
      pageRows.forEach((row) => rows.push(this.toStoreRow(row)));
      if (pageRows.length < PAGE_SIZE) return rows;
    }
    this.logger.warn(
      `Top stores pagination cap reached (${MAX_PAGES * PAGE_SIZE} locations)`
    );
    return rows;
  }

  private async fetchStorePage(
    query: string,
    params: PerformanceWindowParams,
    page: number
  ): Promise<StoreLocationRow[]> {
    const result = await this.hasuraSystemService.executeQuery<{
      business_locations: StoreLocationRow[];
    }>(query, {
      ...this.windowVariables(params),
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    return result?.business_locations ?? [];
  }

  private toStoreRow(row: StoreLocationRow): TopStoreRow {
    return {
      businessLocationId: row.id,
      locationName: row.name,
      businessId: row.business?.id ?? '',
      businessName: row.business?.name ?? '',
      orderCount: this.countOf(row.orders_aggregate),
      completedCount: this.countOf(row.completed),
      gmv: this.sumOf(row.completed, 'total_amount'),
      currency: row.orders?.[0]?.currency ?? '',
      referrer: this.toReferrer(row.business),
    };
  }

  private toReferrer(business: StoreBusiness | null): TopStoreReferrer | null {
    if (business?.referring_agent) {
      return this.agentReferrer(business.referring_agent);
    }
    const shop = business?.referring_business;
    if (!shop) return null;
    return { kind: 'business', name: shop.name, code: shop.business_code };
  }

  private agentReferrer(agent: StoreAgent): TopStoreReferrer {
    const name = `${agent.user?.first_name ?? ''} ${agent.user?.last_name ?? ''}`.trim();
    return { kind: 'agent', name: name || agent.agent_code || '', code: agent.agent_code };
  }

  private cleanCurrencies(rows: CurrencyRow[]): string[] {
    const codes = rows.map((row) => row.currency).filter((code) => CURRENCY_CODE.test(code));
    return [...new Set(codes)].sort();
  }

  private currencyVariables(currencies: string[]): Record<string, string> {
    return Object.fromEntries(currencies.map((code) => [`cur_${code}`, code]));
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

  private countOf(block?: AggBlock): number {
    return block?.aggregate?.count ?? 0;
  }

  private sumOf(
    block: AggBlock | undefined,
    field: 'total_amount' | 'amount'
  ): number {
    const value = Number(block?.aggregate?.sum?.[field] ?? 0);
    return Number.isFinite(value) ? this.roundMoney(value) : 0;
  }

  private average(total: number, count: number): number {
    if (count <= 0) return 0;
    return this.roundMoney(total / count);
  }

  private rate(part: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((part / total) * 1000) / 10;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}

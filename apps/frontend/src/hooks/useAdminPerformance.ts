import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type PerformancePeriod =
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom';

export const PERFORMANCE_PERIODS: PerformancePeriod[] = [
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
  'custom',
];

export interface PerformanceCustomRange {
  from: string;
  to: string;
}

export type TopAgentMetric = 'deliveries' | 'business_referrals';

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

export interface PlatformOrderMetrics {
  total: number;
  completed: number;
  cancelled: number;
  failed: number;
  refunds: number;
  inProgress: number;
  pendingPayment: number;
  completionRate: number;
  cancellationRate: number;
  uniqueClients: number;
  byFulfillment: { delivery: number; pickup: number; shipping: number };
}

export interface PlatformSalesRow {
  currency: string;
  gmv: number;
  collected: number;
  completedCount: number;
  averageOrderValue: number;
}

export interface PlatformPayoutRow {
  currency: string;
  platformRevenue: number;
  agentDeliveryPay: number;
  partnerCommissions: number;
  merchantPayouts: number;
  platformFundedDelivery: number;
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
  inventoryItemsCount?: number;
  itemsPerReferral?: number;
  stockedReferralCount?: number;
  meetsGoldenRatio?: boolean;
  /** sum(itemCount + 1) over referred businesses. */
  score?: number;
  referredBusinesses?: ReferredBusinessSummary[];
  /** Pending representative_compensation_events waiting for Saturday credit. */
  projectedPayoutAmount?: number;
  projectedPayoutCurrency?: string;
  /** Credited representative compensation in the selected window. */
  earnedAmount?: number;
  earnedCurrency?: string;
  isInternal?: boolean;
}

/** Target average sale items per referred business. */
export const GOLDEN_ITEMS_PER_REFERRAL = 10;

export interface PerformanceMarket {
  countryCode: string;
  countryName: string;
}

export interface PayoutPreviewBeneficiary {
  generation: number;
  kind: 'agent' | 'business';
  id: string;
  userId: string;
  name: string;
  amount: number;
  percent: number | null;
  hasAccount: boolean;
}

export interface PayoutPreviewRow {
  referredBusinessId: string;
  referredBusinessName: string;
  itemCount: number;
  referralKind: 'agent' | 'business';
  countryCode: string | null;
  currency: string;
  grossAmount: number;
  payoutConfigKey: string | null;
  wouldCredit: boolean;
  skipReason: 'no_referrer' | 'no_amount' | 'no_account' | null;
  pendingRetry: boolean;
  referrer: {
    kind: 'agent' | 'business';
    id: string;
    userId: string;
    name: string;
  } | null;
  beneficiaries: PayoutPreviewBeneficiary[];
}

export interface CompensationEventRow {
  id: string;
  rule_code: string;
  amount: number;
  currency: string;
  country_code: string;
  status: string;
  created_at: string;
  business?: { id: string; name: string } | null;
}

export interface WeeklyPayoutPreview {
  enabled: boolean;
  cutoffDate: string;
  minItems: number;
  percents: { gen1: number; gen2: number; gen3: number };
  payableCount: number;
  skippedCount: number;
  rows: PayoutPreviewRow[];
  totalsByCurrency: Array<{ currency: string; count: number; gross: number }>;
}

export function resolvePeriodRange(
  period: PerformancePeriod,
  custom?: PerformanceCustomRange
): { from: string; to: string } {
  if (period === 'custom') return custom ?? todayRange();
  const now = new Date();
  const weekOptions = { weekStartsOn: 1 as const };
  switch (period) {
    case 'this_week':
      return toRange(startOfWeek(now, weekOptions), endOfWeek(now, weekOptions));
    case 'last_week': {
      const lastWeek = subWeeks(now, 1);
      return toRange(
        startOfWeek(lastWeek, weekOptions),
        endOfWeek(lastWeek, weekOptions)
      );
    }
    case 'this_month':
      return toRange(startOfMonth(now), endOfMonth(now));
    case 'last_month': {
      const lastMonth = subMonths(now, 1);
      return toRange(startOfMonth(lastMonth), endOfMonth(lastMonth));
    }
    case 'this_year':
      return toRange(startOfYear(now), endOfYear(now));
    case 'last_year': {
      const lastYear = subYears(now, 1);
      return toRange(startOfYear(lastYear), endOfYear(lastYear));
    }
  }
}

function todayRange(): { from: string; to: string } {
  const now = new Date();
  return toRange(startOfDay(now), endOfDay(now));
}

function toRange(from: Date, to: Date): { from: string; to: string } {
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildWindowParams(
  period: PerformancePeriod,
  countryCode: string,
  custom?: PerformanceCustomRange
): URLSearchParams {
  const { from, to } = resolvePeriodRange(period, custom);
  const params = new URLSearchParams({ from, to });
  if (countryCode) params.set('countryCode', countryCode);
  return params;
}

function errorMessage(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ||
    (e as Error)?.message ||
    'Request failed'
  );
}

export function useAdminPerformance() {
  const apiClient = useApiClient();
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async (): Promise<PerformanceMarket[]> => {
    if (!apiClient) return [];
    try {
      const { data } = await apiClient.get<{ markets: PerformanceMarket[] }>(
        '/admin/performance/markets'
      );
      return data.markets;
    } catch (e: unknown) {
      setError(errorMessage(e));
      return [];
    }
  }, [apiClient]);

  const fetchSummary = useCallback(
    async (
      period: PerformancePeriod,
      countryCode: string,
      custom?: PerformanceCustomRange
    ): Promise<PerformanceSummary | null> => {
      if (!apiClient) return null;
      setError(null);
      try {
        const params = buildWindowParams(period, countryCode, custom);
        const { data } = await apiClient.get<PerformanceSummary>(
          `/admin/performance/summary?${params.toString()}`
        );
        return data;
      } catch (e: unknown) {
        setError(errorMessage(e));
        return null;
      }
    },
    [apiClient]
  );

  const fetchPlatformMetrics = useCallback(
    async (
      period: PerformancePeriod,
      countryCode: string,
      custom?: PerformanceCustomRange
    ): Promise<PlatformMetrics | null> => {
      if (!apiClient) return null;
      try {
        const params = buildWindowParams(period, countryCode, custom);
        const { data } = await apiClient.get<PlatformMetrics>(
          `/admin/performance/platform?${params.toString()}`
        );
        return data;
      } catch (e: unknown) {
        setError(errorMessage(e));
        return null;
      }
    },
    [apiClient]
  );

  const fetchTopAgents = useCallback(
    async (
      period: PerformancePeriod,
      countryCode: string,
      metric: TopAgentMetric,
      options?: {
        minItemsPerReferral?: number;
        limit?: number;
        custom?: PerformanceCustomRange;
      }
    ): Promise<TopAgentEntry[]> => {
      if (!apiClient) return [];
      try {
        const params = buildWindowParams(period, countryCode, options?.custom);
        params.set('metric', metric);
        if (options?.minItemsPerReferral != null) {
          params.set(
            'minItemsPerReferral',
            String(options.minItemsPerReferral)
          );
        }
        if (options?.limit != null) {
          params.set('limit', String(options.limit));
        }
        const { data } = await apiClient.get<{ agents: TopAgentEntry[] }>(
          `/admin/performance/top-agents?${params.toString()}`
        );
        return data.agents;
      } catch (e: unknown) {
        setError(errorMessage(e));
        return [];
      }
    },
    [apiClient]
  );

  const fetchPayoutPreview = useCallback(
    async (countryCode: string): Promise<WeeklyPayoutPreview | null> => {
      if (!apiClient) return null;
      try {
        const params = new URLSearchParams();
        if (countryCode) params.set('countryCode', countryCode);
        const qs = params.toString();
        const { data } = await apiClient.get<WeeklyPayoutPreview>(
          `/admin/performance/payout-preview${qs ? `?${qs}` : ''}`
        );
        return data;
      } catch {
        return null;
      }
    },
    [apiClient]
  );

  const fetchCompensationEvents = useCallback(
    async (countryCode: string): Promise<CompensationEventRow[] | null> => {
      if (!apiClient) return null;
      try {
        const params = new URLSearchParams();
        if (countryCode) params.set('countryCode', countryCode);
        const qs = params.toString();
        const { data } = await apiClient.get<{ events: CompensationEventRow[] }>(
          `/admin/performance/compensation-events${qs ? `?${qs}` : ''}`
        );
        return data.events;
      } catch {
        return null;
      }
    },
    [apiClient]
  );

  return {
    fetchMarkets,
    fetchSummary,
    fetchPlatformMetrics,
    fetchTopAgents,
    fetchPayoutPreview,
    fetchCompensationEvents,
    error,
  };
}

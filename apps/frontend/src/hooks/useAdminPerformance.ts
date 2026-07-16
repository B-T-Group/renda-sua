import {
  endOfMonth,
  endOfWeek,
  endOfYear,
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
  | 'last_year';

export const PERFORMANCE_PERIODS: PerformancePeriod[] = [
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
];

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

export interface TopAgentEntry {
  agentId: string;
  agentCode: string | null;
  firstName: string;
  lastName: string;
  count: number;
}

export interface PerformanceMarket {
  countryCode: string;
  countryName: string;
}

export function resolvePeriodRange(period: PerformancePeriod): {
  from: string;
  to: string;
} {
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

function toRange(from: Date, to: Date): { from: string; to: string } {
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildWindowParams(
  period: PerformancePeriod,
  countryCode: string
): URLSearchParams {
  const { from, to } = resolvePeriodRange(period);
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
      countryCode: string
    ): Promise<PerformanceSummary | null> => {
      if (!apiClient) return null;
      setError(null);
      try {
        const params = buildWindowParams(period, countryCode);
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

  const fetchTopAgents = useCallback(
    async (
      period: PerformancePeriod,
      countryCode: string,
      metric: TopAgentMetric
    ): Promise<TopAgentEntry[]> => {
      if (!apiClient) return [];
      try {
        const params = buildWindowParams(period, countryCode);
        params.set('metric', metric);
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

  return { fetchMarkets, fetchSummary, fetchTopAgents, error };
}

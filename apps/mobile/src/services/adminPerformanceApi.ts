import { apiRequest } from './apiClient';
import type {
  PerformanceMarket,
  PerformanceSummary,
  PerformanceWindow,
  TopAgentEntry,
  TopAgentMetric,
} from '../types/adminPerformance';

function windowParams(
  window: PerformanceWindow,
  countryCode?: string
): URLSearchParams {
  const params = new URLSearchParams({ from: window.from, to: window.to });
  if (countryCode) params.set('countryCode', countryCode);
  return params;
}

export async function fetchPerformanceSummary(
  window: PerformanceWindow,
  countryCode?: string
): Promise<PerformanceSummary> {
  const params = windowParams(window, countryCode);
  return apiRequest<PerformanceSummary>(
    `/admin/performance/summary?${params.toString()}`,
    { method: 'GET' }
  );
}

export async function fetchPerformanceTopAgents(
  window: PerformanceWindow,
  metric: TopAgentMetric,
  countryCode?: string,
  options?: { minItemsPerReferral?: number; limit?: number }
): Promise<TopAgentEntry[]> {
  const params = windowParams(window, countryCode);
  params.set('metric', metric);
  if (options?.minItemsPerReferral != null) {
    params.set('minItemsPerReferral', String(options.minItemsPerReferral));
  }
  if (options?.limit != null) {
    params.set('limit', String(options.limit));
  }
  const res = await apiRequest<{ agents: TopAgentEntry[] }>(
    `/admin/performance/top-agents?${params.toString()}`,
    { method: 'GET' }
  );
  return res.agents ?? [];
}

export async function fetchPerformanceMarkets(): Promise<PerformanceMarket[]> {
  const res = await apiRequest<{ markets: PerformanceMarket[] }>(
    '/admin/performance/markets',
    { method: 'GET' }
  );
  return res.markets ?? [];
}

export const adminPerformanceApi = {
  fetchPerformanceSummary,
  fetchPerformanceTopAgents,
  fetchPerformanceMarkets,
};

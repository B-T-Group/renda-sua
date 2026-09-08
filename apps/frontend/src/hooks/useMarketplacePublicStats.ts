import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface MarketplaceLogo {
  id: string;
  name: string;
  logoUrl: string;
}

export interface MarketplacePublicStats {
  clients: number;
  agents: number;
  merchants: number;
  products: number;
  cities: number;
  orders: number;
  setupMinutesMax: number;
  securePaymentsPercent: number;
  logos: MarketplaceLogo[];
}

export type UseMarketplacePublicStatsOptions = {
  refetchIntervalMs?: number;
};

type CacheEntry = {
  stats: MarketplacePublicStats;
  expiresAt: number;
};

type StatsApi = {
  get: <T>(url: string) => Promise<{ data: T }>;
};

let statsCache: CacheEntry | null = null;
let inflight: Promise<MarketplacePublicStats> | null = null;
const CACHE_TTL_MS = 60_000;

export function resetMarketplacePublicStatsCache() {
  statsCache = null;
  inflight = null;
}

/** Format a count for marketing display (e.g. 1250 → "1k+", 42 → "40+"). */
export function formatMarketplaceStat(count: number): string {
  if (count <= 0) return '0';
  if (count < 10) return String(count);
  if (count < 100) return `${Math.floor(count / 10) * 10}+`;
  if (count < 1000) return `${Math.floor(count / 50) * 50}+`;
  if (count < 10000) {
    const tenths = Math.floor(count / 100) / 10;
    return tenths % 1 === 0 ? `${tenths}k+` : `${tenths.toFixed(1)}k+`;
  }
  return `${Math.floor(count / 1000)}k+`;
}

function cacheStats(stats: MarketplacePublicStats): MarketplacePublicStats {
  statsCache = { stats, expiresAt: Date.now() + CACHE_TTL_MS };
  return stats;
}

async function requestPublicStats(api: StatsApi): Promise<MarketplacePublicStats> {
  if (!inflight) {
    inflight = api
      .get<{
        success: boolean;
        data: MarketplacePublicStats;
        message?: string;
      }>('/marketplace/public-stats')
      .then(({ data }) => {
        if (!data.success || !data.data) {
          throw new Error(data.message || 'Failed to load marketplace stats');
        }
        return cacheStats(data.data);
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function loadPublicStats(api: StatsApi): Promise<MarketplacePublicStats> {
  if (statsCache && statsCache.expiresAt > Date.now()) {
    return statsCache.stats;
  }
  return requestPublicStats(api);
}

export function useMarketplacePublicStats(
  options: UseMarketplacePublicStatsOptions = {}
) {
  const { refetchIntervalMs } = options;
  const api = useApiClient();
  const [stats, setStats] = useState<MarketplacePublicStats | null>(
    () => statsCache?.stats ?? null
  );
  const [loading, setLoading] = useState(!statsCache);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(
    async (background = false) => {
      if (statsCache && statsCache.expiresAt > Date.now()) {
        setStats(statsCache.stats);
        setLoading(false);
        return;
      }
      if (!background) setLoading(true);
      setError(null);
      try {
        const result = await loadPublicStats(api);
        setStats(result);
      } catch (err: any) {
        setError(err?.message || 'Failed to load marketplace stats');
        if (!statsCache) setStats(null);
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  useEffect(() => {
    void fetchStats(false);
  }, [fetchStats]);

  useVisibilityPolling(fetchStats, refetchIntervalMs);

  return { stats, loading, error, refetch: fetchStats };
}

function useVisibilityPolling(
  fetchStats: (background?: boolean) => Promise<void>,
  refetchIntervalMs?: number
) {
  useEffect(() => {
    if (!refetchIntervalMs || refetchIntervalMs <= 0) return undefined;
    const poll = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchStats(true);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!statsCache || statsCache.expiresAt <= Date.now()) {
        void fetchStats(true);
      }
    };
    const id = window.setInterval(poll, refetchIntervalMs);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchStats, refetchIntervalMs]);
}

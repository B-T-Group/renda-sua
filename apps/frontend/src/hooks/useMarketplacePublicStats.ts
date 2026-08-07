import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface MarketplaceLogo {
  id: string;
  name: string;
  logoUrl: string;
}

export interface MarketplacePublicStats {
  merchants: number;
  products: number;
  cities: number;
  orders: number;
  setupMinutesMax: number;
  securePaymentsPercent: number;
  logos: MarketplaceLogo[];
}

type CacheEntry = {
  stats: MarketplacePublicStats;
  expiresAt: number;
};

let statsCache: CacheEntry | null = null;
let inflight: Promise<MarketplacePublicStats> | null = null;
const CACHE_TTL_MS = 60_000;

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

export function useMarketplacePublicStats() {
  const api = useApiClient();
  const [stats, setStats] = useState<MarketplacePublicStats | null>(
    () => statsCache?.stats ?? null
  );
  const [loading, setLoading] = useState(!statsCache);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (statsCache && statsCache.expiresAt > Date.now()) {
      setStats(statsCache.stats);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
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
            statsCache = {
              stats: data.data,
              expiresAt: Date.now() + CACHE_TTL_MS,
            };
            return data.data;
          })
          .finally(() => {
            inflight = null;
          });
      }
      const result = await inflight;
      setStats(result);
    } catch (err: any) {
      setStats(null);
      setError(err?.message || 'Failed to load marketplace stats');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

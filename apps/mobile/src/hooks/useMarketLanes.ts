import { useEffect, useState } from 'react';
import { api } from '../services/apiClient';
import { publicApiGet } from '../services/publicApiClient';
import { useStore } from '../stores/RootStore';

export type MarketLaneId = 'rentals' | 'exports' | 'shop' | 'food';

export interface MarketLaneFlags {
  rentals: boolean;
  exports: boolean;
  shop: boolean;
  food: boolean;
}

export interface MarketLanesData {
  country_code: string;
  lanes: MarketLaneFlags;
  visible: MarketLaneId[];
}

/** Fallback before the first successful preflight: shop + rentals always; never invent Exports/Food. */
export const DEFAULT_MARKET_LANES_VISIBLE: MarketLaneId[] = [
  'rentals',
  'shop',
];

type MarketLanesResponse = {
  success?: boolean;
  data?: MarketLanesData;
};

export function useMarketLanes(countryCode: string | null | undefined): {
  visible: MarketLaneId[];
  lanes: MarketLaneFlags | null;
  loading: boolean;
} {
  const { auth } = useStore();
  const [visible, setVisible] = useState<MarketLaneId[]>(
    DEFAULT_MARKET_LANES_VISIBLE
  );
  const [lanes, setLanes] = useState<MarketLaneFlags | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = countryCode?.trim().toUpperCase();
    if (!code || code.length !== 2) {
      setVisible(DEFAULT_MARKET_LANES_VISIBLE);
      setLanes(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const path = `/catalog/market-lanes?country_code=${encodeURIComponent(code)}`;
    const request = auth.isAuthenticated
      ? api.get<MarketLanesResponse>(path)
      : publicApiGet<MarketLanesResponse>(path);
    void Promise.resolve(request)
      .then((response) => {
        if (cancelled) return;
        const payload = response.data;
        if (payload?.visible) {
          setVisible(payload.visible);
          setLanes(payload.lanes ?? null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setVisible(DEFAULT_MARKET_LANES_VISIBLE);
        setLanes(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, countryCode]);

  return { visible, lanes, loading };
}

import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

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

interface MarketLanesApiResponse {
  success?: boolean;
  data?: MarketLanesData;
}

export function useMarketLanes(countryCode: string | null | undefined): {
  visible: MarketLaneId[];
  lanes: MarketLaneFlags | null;
  loading: boolean;
} {
  const apiClient = useApiClient();
  const [visible, setVisible] = useState<MarketLaneId[]>(
    DEFAULT_MARKET_LANES_VISIBLE
  );
  const [lanes, setLanes] = useState<MarketLaneFlags | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = countryCode?.trim().toUpperCase();
    if (!apiClient || !code || code.length !== 2) {
      setVisible(DEFAULT_MARKET_LANES_VISIBLE);
      setLanes(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void apiClient
      .get<MarketLanesApiResponse>('/catalog/market-lanes', {
        params: { country_code: code },
      })
      .then((response) => {
        if (cancelled) return;
        const data = response.data?.data;
        if (data?.visible) {
          setVisible(data.visible);
          setLanes(data.lanes ?? null);
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
  }, [apiClient, countryCode]);

  return { visible, lanes, loading };
}

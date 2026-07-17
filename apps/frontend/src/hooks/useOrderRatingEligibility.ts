import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface OrderRatingEligibilityItem {
  id: string;
  name: string;
  rated: boolean;
}

export interface OrderRatingEligibility {
  canRateAgent: boolean;
  canRateItem: boolean;
  canRateClient: boolean;
  itemRatingUnlocksAt: string | null;
  agentId: string | null;
  clientId: string | null;
  items: OrderRatingEligibilityItem[];
}

export interface UseOrderRatingEligibilityReturn {
  eligibility: OrderRatingEligibility | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Module-level cache + in-flight dedupe so order lists rendering many cards
// don't fire one eligibility request per card (or per re-mount).
const eligibilityCache = new Map<
  string,
  { at: number; data: OrderRatingEligibility | null }
>();
const inflightRequests = new Map<
  string,
  Promise<OrderRatingEligibility | null>
>();
const CACHE_TTL_MS = 60_000;

/**
 * Per-user rating eligibility for an order (drives Rate CTAs).
 * Pass enabled=false to skip fetching (e.g. order not complete yet).
 * Results are cached briefly and deduped across concurrent consumers.
 */
export const useOrderRatingEligibility = (
  orderId: string,
  enabled = true
): UseOrderRatingEligibilityReturn => {
  const [eligibility, setEligibility] =
    useState<OrderRatingEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchEligibility = useCallback(
    async (force = false) => {
      if (!apiClient || !orderId || !enabled) return;

      if (force) {
        eligibilityCache.delete(orderId);
      } else {
        const cached = eligibilityCache.get(orderId);
        if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
          setEligibility(cached.data);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        let request = inflightRequests.get(orderId);
        if (!request) {
          request = apiClient
            .get(`/ratings/order/${orderId}/eligibility`)
            .then((response) => {
              if (!response.data.success) {
                throw new Error(
                  response.data.message || 'Failed to fetch rating eligibility'
                );
              }
              return response.data
                .eligibility as OrderRatingEligibility | null;
            })
            .finally(() => inflightRequests.delete(orderId));
          inflightRequests.set(orderId, request);
        }
        const data = await request;
        eligibilityCache.set(orderId, { at: Date.now(), data });
        setEligibility(data);
      } catch (err: any) {
        setError(
          err.response?.data?.message ||
            err.message ||
            'Failed to fetch rating eligibility'
        );
        setEligibility(null);
      } finally {
        setLoading(false);
      }
    },
    [apiClient, orderId, enabled]
  );

  useEffect(() => {
    // Reset immediately so consumers never act on a previous order's data.
    setEligibility(null);
    setError(null);
    fetchEligibility();
  }, [fetchEligibility]);

  return { eligibility, loading, error, refetch: () => fetchEligibility(true) };
};

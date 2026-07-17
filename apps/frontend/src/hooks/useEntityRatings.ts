import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { OrderRating } from './useOrderRatings';

export interface UseEntityRatingsReturn {
  ratings: OrderRating[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

const PAGE_SIZE = 10;

/** Paginated public ratings received by an entity (agent, client, item...). */
export const useEntityRatings = (
  entityType: string | null,
  entityId: string | null
): UseEntityRatingsReturn => {
  const [ratings, setRatings] = useState<OrderRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const apiClient = useApiClient();

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!apiClient || !entityType || !entityId) return;

      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get(
          `/ratings/entity/${entityType}/${entityId}?limit=${PAGE_SIZE}&offset=${offset}`
        );
        if (response.data.success) {
          const page: OrderRating[] = response.data.ratings || [];
          setRatings((prev) => (replace ? page : [...prev, ...page]));
          setHasMore(page.length === PAGE_SIZE);
        } else {
          setError(response.data.message || 'Failed to fetch ratings');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch ratings');
      } finally {
        setLoading(false);
      }
    },
    [apiClient, entityType, entityId]
  );

  useEffect(() => {
    setRatings([]);
    fetchPage(0, true);
  }, [fetchPage]);

  return {
    ratings,
    loading,
    error,
    hasMore,
    loadMore: () => fetchPage(ratings.length, false),
    refetch: () => fetchPage(0, true),
  };
};

import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface RatingAggregate {
  entity_type: string;
  entity_id: string;
  total_ratings: number;
  average_rating: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
  last_rating_at?: string | null;
}

export interface UseEntityRatingAggregateReturn {
  aggregate: RatingAggregate | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Public rating aggregate (average + counts) for an entity (agent, client, item...). */
export const useEntityRatingAggregate = (
  entityType: string | null,
  entityId: string | null
): UseEntityRatingAggregateReturn => {
  const [aggregate, setAggregate] = useState<RatingAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchAggregate = useCallback(async () => {
    if (!apiClient || !entityType || !entityId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(
        `/ratings/aggregate/${entityType}/${entityId}`
      );
      if (response.data.success) {
        setAggregate(response.data.aggregate);
      } else {
        setError(response.data.message || 'Failed to fetch rating aggregate');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to fetch rating aggregate'
      );
      setAggregate(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, entityType, entityId]);

  useEffect(() => {
    fetchAggregate();
  }, [fetchAggregate]);

  return { aggregate, loading, error, refetch: fetchAggregate };
};

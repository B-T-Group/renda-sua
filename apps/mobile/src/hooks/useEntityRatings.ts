import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { EntityRatingApi, RatingAggregateApi } from '../types/ratingsApi';

const PAGE_SIZE = 10;

/** Public rating aggregate + paginated reviews for an entity (agent, client, item...). */
export function useEntityRatings(
  entityType: string | null | undefined,
  entityId: string | null | undefined
) {
  const [aggregate, setAggregate] = useState<RatingAggregateApi | null>(null);
  const [ratings, setRatings] = useState<EntityRatingApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!entityType || !entityId) return;
      setLoading(true);
      try {
        const [aggRes, listRes] = await Promise.all([
          replace
            ? agentApi.ratings.getAggregate(entityType, entityId)
            : Promise.resolve(null),
          agentApi.ratings.getForEntity(entityType, entityId, PAGE_SIZE, offset),
        ]);
        if (aggRes) setAggregate(aggRes.success ? aggRes.aggregate : null);
        const page = listRes.success ? (listRes.ratings ?? []) : [];
        setRatings((prev) => (replace ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE_SIZE);
      } catch {
        if (replace) {
          setAggregate(null);
          setRatings([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [entityType, entityId]
  );

  useEffect(() => {
    setRatings([]);
    setAggregate(null);
    void fetchPage(0, true);
  }, [fetchPage]);

  return {
    aggregate,
    ratings,
    loading,
    hasMore,
    loadMore: () => fetchPage(ratings.length, false),
    refetch: () => fetchPage(0, true),
  };
}

import { useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { RatingAggregateApi } from '../types/ratingsApi';

/**
 * Rating aggregate received by the current user for the given persona
 * (agent or client). Resolves the persona entity id from /users/me.
 */
export function useMyRatingAggregate(persona: 'agent' | 'client' | null) {
  const [aggregate, setAggregate] = useState<RatingAggregateApi | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!persona) {
      setAggregate(null);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const meRes = await agentApi.users.getMe();
        const entityId =
          persona === 'agent' ? meRes.user?.agent?.id : meRes.user?.client?.id;
        if (!entityId) {
          if (!cancelled) setAggregate(null);
          return;
        }
        const aggRes = await agentApi.ratings.getAggregate(persona, entityId);
        if (!cancelled) setAggregate(aggRes.success ? aggRes.aggregate : null);
      } catch {
        if (!cancelled) setAggregate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persona]);

  return { aggregate, loading };
}

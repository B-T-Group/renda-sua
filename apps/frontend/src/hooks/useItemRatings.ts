import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { OrderRating } from './useOrderRatings';

export interface UseItemRatingsReturn {
  ratings: OrderRating[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useItemRatings = (itemId: string | null): UseItemRatingsReturn => {
  const [ratings, setRatings] = useState<OrderRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchRatings = async () => {
    if (!apiClient || !itemId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/ratings/entity/item/${itemId}?limit=20&offset=0`
      );

      if (response.data.success) {
        setRatings(response.data.ratings || []);
      } else {
        setError(response.data.message || 'Failed to fetch ratings');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch ratings');
      setRatings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (itemId) {
      fetchRatings();
    } else {
      setRatings([]);
      setError(null);
    }
  }, [itemId]);

  return {
    ratings,
    loading,
    error,
    refetch: fetchRatings,
  };
};

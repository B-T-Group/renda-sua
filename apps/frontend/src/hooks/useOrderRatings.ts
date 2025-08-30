import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface OrderRating {
  id: string;
  order_id: string;
  rating_type: string;
  rater_user_id: string;
  rated_entity_type: string;
  rated_entity_id: string;
  rating: number;
  comment?: string;
  is_public: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseOrderRatingsReturn {
  ratings: OrderRating[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useOrderRatings = (orderId: string): UseOrderRatingsReturn => {
  const [ratings, setRatings] = useState<OrderRating[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const fetchRatings = async () => {
    if (!apiClient || !orderId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/ratings/order/${orderId}`);

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
    if (orderId) {
      fetchRatings();
    }
  }, [orderId]);

  return {
    ratings,
    loading,
    error,
    refetch: fetchRatings,
  };
};

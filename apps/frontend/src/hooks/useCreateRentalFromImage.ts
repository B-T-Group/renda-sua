import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface CreateRentalFromImagePayload {
  /** Default manual: uses name and rental_category_id from the body. */
  mode?: 'manual' | 'ai';
  imageId: string;
  name?: string;
  rental_category_id?: string;
  description?: string;
  currency?: string;
  is_active?: boolean;
  tags?: string[];
}

export const useCreateRentalFromImage = () => {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRentalFromImage = useCallback(
    async (payload: CreateRentalFromImagePayload) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: { item: { id: string; name: string } };
          error?: string;
        }>('/rental-item-images/create-rental-from-image', payload);
        if (!response.data.success) {
          setError(response.data.error || 'Failed to create rental item');
          return null;
        }
        return response.data.data ?? null;
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to create rental item'
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { createRentalFromImage, loading, error };
};

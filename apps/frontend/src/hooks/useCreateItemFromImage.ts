import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface CreateItemFromImagePayload {
  imageId: string;
  name: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  description?: string;
   price?: number;
   currency?: string;
}

export const useCreateItemFromImage = () => {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createItemFromImage = useCallback(
    async (payload: CreateItemFromImagePayload) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: { item: any } | any;
          error?: string;
        }>('/business-items/create-from-image', payload);
        if (!response.data.success) {
          setError(
            response.data.error || 'Failed to create item from image'
          );
          return null;
        }
        return response.data.data || null;
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to create item from image'
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { createItemFromImage, loading, error };
};


import { useState } from 'react';
import { useApiClient } from './useApiClient';

export interface GenerateDescriptionRequest {
  name: string;
  sku?: string;
  category?: string;
  subCategory?: string;
  price?: number;
  currency?: string;
  weight?: number;
  weightUnit?: string;
  brand?: string;
  language?: 'en' | 'fr';
}

export interface GenerateDescriptionResponse {
  success: boolean;
  description: string;
  message: string;
}

export const useAi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const generateDescription = async (
    request: GenerateDescriptionRequest
  ): Promise<GenerateDescriptionResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<GenerateDescriptionResponse>(
        '/ai/generate-description',
        request
      );

      return response.data;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to generate product description';

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    generateDescription,
    loading,
    error,
  };
};

import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface AdminMessageRequest {
  entity_type: string;
  entity_id: string;
  message: string;
}

export interface AdminMessageResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

export const useAdminMessage = () => {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postMessage = useCallback(
    async (messageData: AdminMessageRequest): Promise<AdminMessageResponse> => {
      if (!apiClient) {
        return {
          success: false,
          error: 'API client not available',
        };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post<AdminMessageResponse>(
          '/admin/message',
          messageData
        );

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error || err.message || 'Failed to post message';
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return {
    postMessage,
    loading,
    error,
  };
};
